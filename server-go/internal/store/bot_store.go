package store

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

const botColumns = `id, user_id, name, avatar_url, description, tags, auto_reply,
	sort_order, model, ai_config, created_at, updated_at`

// replyColumns is the shared select list for bot_replies rows.
const replyColumns = `id, memo_id, bot_id, content, thinking_content,
	parent_reply_id, user_question, revision_number, created_at`

// BotStore reads and writes bots, bot replies and the reply-resource links.
type BotStore struct {
	pool *pgxpool.Pool
}

func NewBotStore(pool *pgxpool.Pool) *BotStore {
	return &BotStore{pool: pool}
}

func scanBot(row pgx.Row) (domain.Bot, error) {
	var (
		bot      domain.Bot
		tags     []byte
		aiConfig []byte
	)
	err := row.Scan(
		&bot.ID, &bot.UserID, &bot.Name, &bot.AvatarURL, &bot.Description, &tags,
		&bot.AutoReply, &bot.SortOrder, &bot.Model, &aiConfig,
		&bot.CreatedAt, &bot.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Bot{}, domain.ErrNoRows
	}
	if err != nil {
		return domain.Bot{}, err
	}
	bot.Tags = domain.TagListFromJSON(tags)
	if len(aiConfig) > 0 {
		_ = json.Unmarshal(aiConfig, &bot.AIConfig)
	}
	return bot, nil
}

func scanReply(row pgx.Row) (domain.BotReply, error) {
	var reply domain.BotReply
	err := row.Scan(
		&reply.ID, &reply.MemoID, &reply.BotID, &reply.Content,
		&reply.ThinkingContent, &reply.ParentReplyID, &reply.UserQuestion,
		&reply.RevisionNumber, &reply.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.BotReply{}, domain.ErrNoRows
	}
	return reply, err
}

func collectReplies(rows pgx.Rows) ([]domain.BotReply, error) {
	replies := []domain.BotReply{}
	for rows.Next() {
		reply, err := scanReply(rows)
		if err != nil {
			return nil, err
		}
		replies = append(replies, reply)
	}
	return replies, rows.Err()
}

// List returns a user's live bots in display order.
func (s *BotStore) List(ctx context.Context, userID uuid.UUID) ([]domain.Bot, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT `+botColumns+` FROM bots
		 WHERE user_id = $1 AND is_deleted = FALSE
		 ORDER BY sort_order ASC, created_at ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	bots := []domain.Bot{}
	for rows.Next() {
		bot, err := scanBot(rows)
		if err != nil {
			return nil, err
		}
		bots = append(bots, bot)
	}
	return bots, rows.Err()
}

// Get returns a live bot owned by the user.
func (s *BotStore) Get(ctx context.Context, userID, botID uuid.UUID) (domain.Bot, error) {
	return scanBot(s.pool.QueryRow(ctx,
		`SELECT `+botColumns+` FROM bots
		 WHERE id = $1 AND user_id = $2 AND is_deleted = FALSE`, botID, userID))
}

// ByID returns a bot without filtering on is_deleted, for embedded references.
func (s *BotStore) ByID(ctx context.Context, userID, botID uuid.UUID) (domain.Bot, error) {
	return scanBot(s.pool.QueryRow(ctx,
		`SELECT `+botColumns+` FROM bots WHERE id = $1 AND user_id = $2`, botID, userID))
}

// Create inserts a bot and returns the stored row.
func (s *BotStore) Create(ctx context.Context, bot domain.Bot) (domain.Bot, error) {
	return scanBot(s.pool.QueryRow(ctx,
		`INSERT INTO bots (id, user_id, name, avatar_url, description, tags, auto_reply,
			sort_order, model, ai_config, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10::jsonb, $11, $12)
		 RETURNING `+botColumns,
		bot.ID, bot.UserID, bot.Name, bot.AvatarURL, bot.Description, marshalTags(bot.Tags),
		bot.AutoReply, bot.SortOrder, bot.Model, marshalAIConfig(bot.AIConfig),
		bot.CreatedAt, bot.UpdatedAt))
}

// Update writes every field of the supplied bot and returns the stored row.
func (s *BotStore) Update(ctx context.Context, bot domain.Bot) (domain.Bot, error) {
	return scanBot(s.pool.QueryRow(ctx,
		`UPDATE bots SET name = $1, avatar_url = $2, description = $3, tags = $4::jsonb,
			auto_reply = $5, sort_order = $6, model = $7, ai_config = $8::jsonb,
			updated_at = $9
		 WHERE id = $10 AND user_id = $11
		 RETURNING `+botColumns,
		bot.Name, bot.AvatarURL, bot.Description, marshalTags(bot.Tags), bot.AutoReply,
		bot.SortOrder, bot.Model, marshalAIConfig(bot.AIConfig), bot.UpdatedAt,
		bot.ID, bot.UserID))
}

// SoftDelete marks a bot deleted.
func (s *BotStore) SoftDelete(ctx context.Context, userID, botID uuid.UUID, now int64) error {
	tag, err := s.pool.Exec(ctx,
		`UPDATE bots SET is_deleted = TRUE, updated_at = $1 WHERE id = $2 AND user_id = $3`,
		now, botID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNoRows
	}
	return nil
}

// MaxSortOrder returns the current highest sort order, or nil when the user has
// no bots.
func (s *BotStore) MaxSortOrder(ctx context.Context, userID uuid.UUID) (*int32, error) {
	var maxOrder *int32
	err := s.pool.QueryRow(ctx,
		`SELECT MAX(sort_order) FROM bots WHERE user_id = $1`, userID).Scan(&maxOrder)
	return maxOrder, err
}

// Reorder writes the supplied identifiers as sort_order starting at zero.
func (s *BotStore) Reorder(
	ctx context.Context,
	userID uuid.UUID,
	order []uuid.UUID,
	now int64,
) error {
	for index, botID := range order {
		if _, err := s.pool.Exec(ctx,
			`UPDATE bots SET sort_order = $1, updated_at = $2 WHERE id = $3 AND user_id = $4`,
			int32(index), now, botID, userID); err != nil {
			return err
		}
	}
	return nil
}

// MemoryStats reports the debug-log activity per bot for one user.
func (s *BotStore) MemoryStats(
	ctx context.Context,
	userID uuid.UUID,
) (map[uuid.UUID]domain.BotMemoryStats, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT bot_id, COUNT(*), MAX(created_at)
		 FROM bot_memory_debug_logs WHERE user_id = $1 GROUP BY bot_id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := make(map[uuid.UUID]domain.BotMemoryStats)
	for rows.Next() {
		var (
			botID     uuid.UUID
			total     int64
			last      *int64
			collected domain.BotMemoryStats
		)
		if err := rows.Scan(&botID, &total, &last); err != nil {
			return nil, err
		}
		collected.TotalContextsBuilt = total
		collected.LastContextAt = last
		stats[botID] = collected
	}
	return stats, rows.Err()
}

// AutoReplyBots returns the bots that reply to memos automatically.
func (s *BotStore) AutoReplyBots(ctx context.Context, userID uuid.UUID) ([]domain.Bot, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT `+botColumns+` FROM bots
		 WHERE user_id = $1 AND auto_reply = TRUE AND is_deleted = FALSE
		 ORDER BY sort_order ASC, created_at ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	bots := []domain.Bot{}
	for rows.Next() {
		bot, err := scanBot(rows)
		if err != nil {
			return nil, err
		}
		bots = append(bots, bot)
	}
	return bots, rows.Err()
}

// RepliesForMemo returns every reply on a memo owned by the user, oldest first.
func (s *BotStore) RepliesForMemo(
	ctx context.Context,
	userID, memoID uuid.UUID,
) ([]domain.BotReply, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT br.id, br.memo_id, br.bot_id, br.content, br.thinking_content,
			br.parent_reply_id, br.user_question, br.revision_number, br.created_at
		 FROM bot_replies br JOIN bots b ON b.id = br.bot_id
		 WHERE br.memo_id = $1 AND b.user_id = $2
		 ORDER BY br.created_at ASC`, memoID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectReplies(rows)
}

// BotSummariesByID returns shallow references for the requested bots.
func (s *BotStore) BotSummariesByID(
	ctx context.Context,
	userID uuid.UUID,
	ids []uuid.UUID,
) ([]domain.BotSummary, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, name, avatar_url FROM bots WHERE user_id = $1 AND id = ANY($2)`,
		userID, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	summaries := []domain.BotSummary{}
	for rows.Next() {
		var summary domain.BotSummary
		if err := rows.Scan(&summary.ID, &summary.Name, &summary.AvatarURL); err != nil {
			return nil, err
		}
		summaries = append(summaries, summary)
	}
	return summaries, rows.Err()
}

// ReplyByID returns one reply after checking it belongs to the user's bot.
func (s *BotStore) ReplyByID(
	ctx context.Context,
	userID, replyID uuid.UUID,
) (domain.BotReply, error) {
	return scanReply(s.pool.QueryRow(ctx,
		`SELECT br.id, br.memo_id, br.bot_id, br.content, br.thinking_content,
			br.parent_reply_id, br.user_question, br.revision_number, br.created_at
		 FROM bot_replies br JOIN bots b ON b.id = br.bot_id
		 WHERE br.id = $1 AND b.user_id = $2`, replyID, userID))
}

// ThreadReplies walks the parent/child edges around the seed reply and returns
// the whole conversation, oldest first.
func (s *BotStore) ThreadReplies(
	ctx context.Context,
	memoID, botID, seedReplyID uuid.UUID,
) ([]domain.BotReply, error) {
	rows, err := s.pool.Query(ctx,
		`WITH RECURSIVE thread_edges AS (
			SELECT id, parent_reply_id AS connected_id FROM bot_replies
			WHERE memo_id = $1 AND bot_id = $2 AND parent_reply_id IS NOT NULL
			UNION ALL
			SELECT parent_reply_id AS id, id AS connected_id FROM bot_replies
			WHERE memo_id = $1 AND bot_id = $2 AND parent_reply_id IS NOT NULL
		), thread_replies(id) AS (
			SELECT $3::uuid
			UNION
			SELECT edges.connected_id FROM thread_replies current
			JOIN thread_edges edges ON edges.id = current.id
		)
		SELECT br.id, br.memo_id, br.bot_id, br.content, br.thinking_content,
			br.parent_reply_id, br.user_question, br.revision_number, br.created_at
		FROM bot_replies br
		WHERE br.memo_id = $1 AND br.bot_id = $2
		  AND br.id IN (SELECT id FROM thread_replies)
		ORDER BY br.created_at ASC`, memoID, botID, seedReplyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectReplies(rows)
}

// ResourceIDsForReplies maps each reply to the resources attached to it.
func (s *BotStore) ResourceIDsForReplies(
	ctx context.Context,
	replyIDs []uuid.UUID,
) (map[uuid.UUID][]uuid.UUID, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT reply_id, resource_id FROM bot_reply_resources
		 WHERE reply_id = ANY($1) ORDER BY reply_id, sort_order`, replyIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	resources := make(map[uuid.UUID][]uuid.UUID)
	for rows.Next() {
		var replyID, resourceID uuid.UUID
		if err := rows.Scan(&replyID, &resourceID); err != nil {
			return nil, err
		}
		resources[replyID] = append(resources[replyID], resourceID)
	}
	return resources, rows.Err()
}

// InsertReply stores a manually produced reply.
func (s *BotStore) InsertReply(ctx context.Context, reply domain.BotReply) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO bot_replies
			(id, memo_id, bot_id, content, thinking_content, parent_reply_id,
			 user_question, revision_number, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		reply.ID, reply.MemoID, reply.BotID, reply.Content, reply.ThinkingContent,
		reply.ParentReplyID, reply.UserQuestion, reply.RevisionNumber, reply.CreatedAt)
	return err
}

// InsertAutoReply stores an automatic reply only while the memo revision still
// matches and no canonical auto reply exists. It reports whether a row landed.
func (s *BotStore) InsertAutoReply(
	ctx context.Context,
	reply domain.BotReply,
	expectedRevision int32,
) (bool, error) {
	tag, err := s.pool.Exec(ctx,
		`INSERT INTO bot_replies
			(id, memo_id, bot_id, content, thinking_content, parent_reply_id,
			 user_question, revision_number, created_at)
		 SELECT $1, $2, $3, $4, $5, NULL, NULL, $6, $7
		 WHERE EXISTS (
			SELECT 1 FROM memos
			WHERE id = $2 AND is_deleted = FALSE AND revision_count = $6
		 )
		   AND NOT EXISTS (
			SELECT 1 FROM bot_replies
			WHERE memo_id = $2 AND bot_id = $3
			  AND parent_reply_id IS NULL AND user_question IS NULL
			  AND revision_number = $6
		 )`,
		reply.ID, reply.MemoID, reply.BotID, reply.Content, reply.ThinkingContent,
		expectedRevision, reply.CreatedAt)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

// InsertReplyResources links resources to a reply, ignoring duplicates.
func (s *BotStore) InsertReplyResources(
	ctx context.Context,
	replyID uuid.UUID,
	resourceIDs []uuid.UUID,
	now int64,
) error {
	for index, resourceID := range resourceIDs {
		if _, err := s.pool.Exec(ctx,
			`INSERT INTO bot_reply_resources (reply_id, resource_id, sort_order, created_at)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (reply_id, resource_id) DO NOTHING`,
			replyID, resourceID, int32(index), now); err != nil {
			return err
		}
	}
	return nil
}

// MemoForBot returns a live memo the bot flow may reply to.
func (s *BotStore) MemoForBot(
	ctx context.Context,
	userID, memoID uuid.UUID,
) (domain.Memo, error) {
	return scanMemo(s.pool.QueryRow(ctx,
		`SELECT `+memoColumns+` FROM memos
		 WHERE id = $1 AND user_id = $2 AND is_deleted = FALSE`, memoID, userID))
}

// RevisionsForContext returns a memo's revisions up to and including a version.
func (s *BotStore) RevisionsForContext(
	ctx context.Context,
	memoID uuid.UUID,
	upTo int32,
) ([]domain.MemoRevision, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, memo_id, user_id, revision_number, content, tags, ai_summary,
			is_deleted, created_at
		 FROM memo_revisions
		 WHERE memo_id = $1 AND revision_number <= $2 AND is_deleted = false
		 ORDER BY revision_number ASC`, memoID, upTo)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	revisions := []domain.MemoRevision{}
	for rows.Next() {
		revision, err := scanRevision(rows)
		if err != nil {
			return nil, err
		}
		revisions = append(revisions, revision)
	}
	return revisions, rows.Err()
}

func marshalAIConfig(config map[string]any) []byte {
	if config == nil {
		return nil
	}
	encoded, err := json.Marshal(config)
	if err != nil {
		return nil
	}
	return encoded
}
