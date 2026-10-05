package store

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// retrievalCandidateLimit caps the candidate window, matching the previous
// server's MAX_CANDIDATES.
const retrievalCandidateLimit = 30

// MemoryStore reads the memo-embedding and bot-memory tables.
type MemoryStore struct {
	pool *pgxpool.Pool
}

func NewMemoryStore(pool *pgxpool.Pool) *MemoryStore {
	return &MemoryStore{pool: pool}
}

// Stats counts live memos and how many of them carry an embedding.
func (s *MemoryStore) Stats(ctx context.Context, userID uuid.UUID) (domain.MemoryStats, error) {
	var stats domain.MemoryStats
	err := s.pool.QueryRow(ctx,
		`SELECT
			(SELECT COUNT(*) FROM memos WHERE user_id = $1 AND is_deleted = FALSE)::bigint,
			(SELECT COUNT(*) FROM memo_embeddings me
			 JOIN memos m ON me.memo_id = m.id
			 WHERE m.user_id = $1 AND m.is_deleted = FALSE)::bigint`, userID).
		Scan(&stats.TotalMemos, &stats.IndexedMemos)
	return stats, err
}

// Activity returns the most recent context builds for a user.
func (s *MemoryStore) Activity(
	ctx context.Context,
	userID uuid.UUID,
	limit int32,
) ([]service.MemoryActivityEntry, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT l.id, l.bot_id, b.name, l.memo_id, l.retrieved_memo_ids,
			l.prompt_size, l.created_at
		 FROM bot_memory_debug_logs l JOIN bots b ON b.id = l.bot_id
		 WHERE l.user_id = $1
		 ORDER BY l.created_at DESC LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entries := []service.MemoryActivityEntry{}
	for rows.Next() {
		var (
			entry     service.MemoryActivityEntry
			retrieved []byte
		)
		if err := rows.Scan(&entry.ID, &entry.BotID, &entry.BotName, &entry.MemoID,
			&retrieved, &entry.PromptSize, &entry.CreatedAt); err != nil {
			return nil, err
		}
		entry.RetrievedCount = int64(len(parseUUIDList(retrieved)))
		entries = append(entries, entry)
	}
	return entries, rows.Err()
}

// LatestDebugLog returns the newest context build for a memo+bot pair.
func (s *MemoryStore) LatestDebugLog(
	ctx context.Context,
	userID, memoID, botID uuid.UUID,
) (service.MemoryDebugLog, bool, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT bot_id, retrieved_memo_ids, score_payload, prompt_size, created_at
		 FROM bot_memory_debug_logs
		 WHERE user_id = $1 AND memo_id = $2 AND bot_id = $3
		 ORDER BY created_at DESC LIMIT 1`, userID, memoID, botID)
	log, err := scanDebugLog(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return service.MemoryDebugLog{}, false, nil
	}
	if err != nil {
		return service.MemoryDebugLog{}, false, err
	}
	return log, true, nil
}

// DebugLogsForMemo returns the newest log per bot that replied to a memo.
func (s *MemoryStore) DebugLogsForMemo(
	ctx context.Context,
	userID, memoID uuid.UUID,
) ([]service.MemoryDebugLog, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT DISTINCT ON (bot_id) bot_id, retrieved_memo_ids, score_payload,
			prompt_size, created_at
		 FROM bot_memory_debug_logs
		 WHERE user_id = $1 AND memo_id = $2
		 ORDER BY bot_id, created_at DESC`, userID, memoID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	logs := []service.MemoryDebugLog{}
	for rows.Next() {
		log, err := scanDebugLog(rows)
		if err != nil {
			return nil, err
		}
		logs = append(logs, log)
	}
	return logs, rows.Err()
}

// MemosByIDs returns the live memos matching the identifiers.
func (s *MemoryStore) MemosByIDs(ctx context.Context, ids []uuid.UUID) ([]domain.Memo, error) {
	if len(ids) == 0 {
		return []domain.Memo{}, nil
	}
	rows, err := s.pool.Query(ctx,
		`SELECT `+memoColumns+` FROM memos WHERE id = ANY($1) AND is_deleted = FALSE`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	memos := []domain.Memo{}
	for rows.Next() {
		memo, err := scanMemo(rows)
		if err != nil {
			return nil, err
		}
		memos = append(memos, memo)
	}
	return memos, rows.Err()
}

// SaveDebugLog records how one bot's context was assembled.
func (s *MemoryStore) SaveDebugLog(
	ctx context.Context,
	userID, memoID uuid.UUID,
	log service.MemoryDebugLog,
) error {
	payload := make([]map[string]any, 0, len(log.Scores))
	for _, score := range log.Scores {
		payload = append(payload, map[string]any{
			"memoId": score.MemoID.String(),
			"score":  score.Score,
			"reason": score.Reason,
		})
	}
	_, err := s.pool.Exec(ctx,
		`INSERT INTO bot_memory_debug_logs
			(id, user_id, memo_id, bot_id, mode, retrieved_memo_ids, score_payload,
			 prompt_size, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)`,
		uuid.New(), userID, memoID, log.BotID, "context_build",
		marshalUUIDList(log.RetrievedMemoIDs), marshalJSON(payload),
		log.PromptSize, log.CreatedAt)
	return err
}

// RetrievalCandidates gathers the vector-similar and recent memos around an
// anchor. Similarity stays in SQL as a cosine distance.
func (s *MemoryStore) RetrievalCandidates(
	ctx context.Context,
	userID, anchorMemoID uuid.UUID,
	recentCutoffMs int64,
) ([]domain.MemoryCandidate, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT m.id,
			COALESCE(NULLIF(m.ai_summary, ''), m.content) AS content,
			m.tags, m.created_at,
			CASE
			  WHEN me.embedding IS NOT NULL AND anchor.embedding IS NOT NULL
			       THEN 1.0 - (me.embedding <=> anchor.embedding)
			  ELSE NULL
			END AS similarity
		 FROM memos m
		 LEFT JOIN memo_embeddings me ON me.memo_id = m.id
		 LEFT JOIN memo_embeddings anchor ON anchor.memo_id = $2
		 WHERE m.user_id = $1 AND m.is_deleted = false AND m.id <> $2
		   AND (
			 (me.embedding IS NOT NULL AND anchor.embedding IS NOT NULL)
			 OR m.created_at >= $3
		   )
		 ORDER BY COALESCE(1.0 - (me.embedding <=> anchor.embedding), 0) DESC,
			m.created_at DESC
		 LIMIT $4`,
		userID, anchorMemoID, recentCutoffMs, retrievalCandidateLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	candidates := []domain.MemoryCandidate{}
	for rows.Next() {
		var (
			candidate  domain.MemoryCandidate
			tags       []byte
			similarity *float64
		)
		if err := rows.Scan(&candidate.MemoID, &candidate.Content, &tags,
			&candidate.CreatedAt, &similarity); err != nil {
			return nil, err
		}
		candidate.Tags = domain.TagListFromJSON(tags)
		if similarity != nil {
			candidate.VectorScore = *similarity
		}
		candidates = append(candidates, candidate)
	}
	return candidates, rows.Err()
}

// MemoVersion reports the compare-and-swap guard for an embedding refresh.
func (s *MemoryStore) MemoVersion(
	ctx context.Context,
	memoID uuid.UUID,
) (int32, int64, bool, error) {
	var (
		revision  int32
		updatedAt int64
	)
	err := s.pool.QueryRow(ctx,
		`SELECT revision_count, updated_at FROM memos
		 WHERE id = $1 AND is_deleted = false`, memoID).Scan(&revision, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, 0, false, nil
	}
	if err != nil {
		return 0, 0, false, err
	}
	return revision, updatedAt, true, nil
}

// UpsertEmbedding stores a memo's vector.
func (s *MemoryStore) UpsertEmbedding(
	ctx context.Context,
	memoID uuid.UUID,
	sourceText, provider, model string,
	embedding []float32,
	now int64,
) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO memo_embeddings
			(memo_id, source_text, provider, model, embedding, updated_at)
		 VALUES ($1, $2, $3, $4, $5::vector, $6)
		 ON CONFLICT (memo_id) DO UPDATE SET
			source_text = EXCLUDED.source_text,
			provider = EXCLUDED.provider,
			model = EXCLUDED.model,
			embedding = EXCLUDED.embedding,
			updated_at = EXCLUDED.updated_at`,
		memoID, sourceText, provider, model, vectorLiteral(embedding), now)
	return err
}

func scanDebugLog(row pgx.Row) (service.MemoryDebugLog, error) {
	var (
		log       service.MemoryDebugLog
		retrieved []byte
		scores    []byte
	)
	err := row.Scan(&log.BotID, &retrieved, &scores, &log.PromptSize, &log.CreatedAt)
	if err != nil {
		return service.MemoryDebugLog{}, err
	}
	log.RetrievedMemoIDs = parseUUIDList(retrieved)
	log.Scores = parseScores(scores)
	return log, nil
}

func parseUUIDList(raw []byte) []uuid.UUID {
	if len(raw) == 0 {
		return []uuid.UUID{}
	}
	var values []string
	if err := json.Unmarshal(raw, &values); err != nil {
		return []uuid.UUID{}
	}
	ids := make([]uuid.UUID, 0, len(values))
	for _, value := range values {
		if id, err := uuid.Parse(value); err == nil {
			ids = append(ids, id)
		}
	}
	return ids
}

func parseScores(raw []byte) []service.MemoryScore {
	if len(raw) == 0 {
		return []service.MemoryScore{}
	}
	var payload []map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return []service.MemoryScore{}
	}
	scores := make([]service.MemoryScore, 0, len(payload))
	for _, item := range payload {
		rawID, _ := item["memoId"].(string)
		id, err := uuid.Parse(rawID)
		if err != nil {
			continue
		}
		score, _ := item["score"].(float64)
		reason, _ := item["reason"].(string)
		scores = append(scores, service.MemoryScore{MemoID: id, Score: score, Reason: reason})
	}
	return scores
}

func marshalUUIDList(ids []uuid.UUID) []byte {
	values := make([]string, 0, len(ids))
	for _, id := range ids {
		values = append(values, id.String())
	}
	return marshalJSON(values)
}

func marshalJSON(value any) []byte {
	if value == nil {
		return []byte("null")
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return []byte("null")
	}
	return encoded
}

// vectorLiteral renders a float vector for a ::vector cast.
func vectorLiteral(values []float32) string {
	var builder strings.Builder
	builder.WriteByte('[')
	for i, value := range values {
		if i > 0 {
			builder.WriteByte(',')
		}
		builder.WriteString(strconv.FormatFloat(float64(value), 'g', -1, 32))
	}
	builder.WriteByte(']')
	return builder.String()
}
