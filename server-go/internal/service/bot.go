package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/admin"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// BotView is a bot paired with the memory activity recorded for it. The list
// endpoint reports both; a single-bot read reports only the bot.
type BotView struct {
	Bot   domain.Bot
	Stats domain.BotMemoryStats
}

// CreateBotInput carries the fields a create request may set.
type CreateBotInput struct {
	Name        string
	AvatarURL   *string
	Description string
	Tags        []string
	AutoReply   bool
	Model       *string
	AIConfig    map[string]any
}

// UpdateBotInput carries the optional fields an update request may set. The Set
// flags distinguish an absent field from an explicit null, which clears it.
type UpdateBotInput struct {
	Name        *string
	Description *string
	Tags        *[]string
	AutoReply   *bool
	SortOrder   *int32

	SetAvatar bool
	AvatarURL *string

	SetModel bool
	Model    *string

	SetAIConfig bool
	AIConfig    map[string]any
}

// BotStore is the persistence the bot service depends on.
type BotStore interface {
	List(ctx context.Context, userID uuid.UUID) ([]domain.Bot, error)
	Get(ctx context.Context, userID, botID uuid.UUID) (domain.Bot, error)
	ByID(ctx context.Context, userID, botID uuid.UUID) (domain.Bot, error)
	Create(ctx context.Context, bot domain.Bot) (domain.Bot, error)
	Update(ctx context.Context, bot domain.Bot) (domain.Bot, error)
	SoftDelete(ctx context.Context, userID, botID uuid.UUID, now int64) error
	MaxSortOrder(ctx context.Context, userID uuid.UUID) (*int32, error)
	Reorder(ctx context.Context, userID uuid.UUID, order []uuid.UUID, now int64) error
	MemoryStats(ctx context.Context, userID uuid.UUID) (map[uuid.UUID]domain.BotMemoryStats, error)
	AutoReplyBots(ctx context.Context, userID uuid.UUID) ([]domain.Bot, error)

	RepliesForMemo(ctx context.Context, userID, memoID uuid.UUID) ([]domain.BotReply, error)
	BotSummariesByID(ctx context.Context, userID uuid.UUID, ids []uuid.UUID) ([]domain.BotSummary, error)
	ReplyByID(ctx context.Context, userID, replyID uuid.UUID) (domain.BotReply, error)
	ThreadReplies(ctx context.Context, memoID, botID, seedReplyID uuid.UUID) ([]domain.BotReply, error)
	ResourceIDsForReplies(ctx context.Context, replyIDs []uuid.UUID) (map[uuid.UUID][]uuid.UUID, error)
	InsertReply(ctx context.Context, reply domain.BotReply) error
	InsertAutoReply(ctx context.Context, reply domain.BotReply, expectedRevision int32) (bool, error)
	InsertReplyResources(ctx context.Context, replyID uuid.UUID, resourceIDs []uuid.UUID, now int64) error
}

// BotMemoStore is the narrow slice of memo persistence bot replies need.
type BotMemoStore interface {
	MemoForBot(ctx context.Context, userID, memoID uuid.UUID) (domain.Memo, error)
	RevisionsForContext(ctx context.Context, memoID uuid.UUID, upTo int32) ([]domain.MemoRevision, error)
}

// MemoryContextBuilder assembles and records the memory background a bot reply
// is generated from.
type MemoryContextBuilder interface {
	BuildForMemo(ctx context.Context, memo domain.Memo) (domain.BotMemoryContext, error)
	PersistForBot(
		ctx context.Context,
		userID, memoID, botID uuid.UUID,
		memoryContext domain.BotMemoryContext,
	) error
}

// ChatConfigProvider resolves the caller's chat provider settings.
type ChatConfigProvider interface {
	ChatConfig(ctx context.Context, userID uuid.UUID) (domain.AIConfig, error)
}

// TimezoneProvider resolves the application timezone used in prompts.
type TimezoneProvider interface {
	Timezone(ctx context.Context) *time.Location
}

// BotService implements the bot, bot-reply and conversation endpoints.
type BotService struct {
	bots        BotStore
	memos       BotMemoStore
	memory      MemoryContextBuilder
	configs     ChatConfigProvider
	completions CompletionClient
	images      ImageProvider
	timezones   TimezoneProvider
	activity    *admin.ActivityLog
	now         func() int64
	locks       MemoGenerationLocks
}

func NewBotService(
	bots BotStore,
	memos BotMemoStore,
	memory MemoryContextBuilder,
	configs ChatConfigProvider,
	completions CompletionClient,
	images ImageProvider,
	timezones TimezoneProvider,
	activity *admin.ActivityLog,
	locks MemoGenerationLocks,
) *BotService {
	return &BotService{
		bots:        bots,
		memos:       memos,
		memory:      memory,
		configs:     configs,
		completions: completions,
		images:      images,
		timezones:   timezones,
		activity:    activity,
		now:         func() int64 { return time.Now().UnixMilli() },
		locks:       locks,
	}
}

// WithClock replaces the clock. Intended for tests.
func (s *BotService) WithClock(now func() int64) *BotService {
	s.now = now
	return s
}

// ListBots returns every live bot with its memory activity summary.
func (s *BotService) ListBots(ctx context.Context, userID string) ([]BotView, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, domain.InvalidUUID(err)
	}
	bots, err := s.bots.List(ctx, id)
	if err != nil {
		return nil, domain.Internal(err)
	}
	stats, err := s.bots.MemoryStats(ctx, id)
	if err != nil {
		return nil, domain.Internal(err)
	}

	views := make([]BotView, 0, len(bots))
	for _, bot := range bots {
		views = append(views, BotView{Bot: bot, Stats: stats[bot.ID]})
	}
	return views, nil
}

// GetBot returns one live bot.
func (s *BotService) GetBot(ctx context.Context, userID string, botID uuid.UUID) (domain.Bot, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domain.Bot{}, domain.InvalidUUID(err)
	}
	bot, err := s.bots.Get(ctx, id, botID)
	if errors.Is(err, domain.ErrNoRows) {
		return domain.Bot{}, domain.BotNotFound()
	}
	if err != nil {
		return domain.Bot{}, domain.Internal(err)
	}
	return bot, nil
}

// CreateBot appends a bot to the end of the caller's ordering.
func (s *BotService) CreateBot(
	ctx context.Context,
	userID string,
	input CreateBotInput,
) (domain.Bot, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domain.Bot{}, domain.InvalidUUID(err)
	}

	maxOrder, err := s.bots.MaxSortOrder(ctx, id)
	if err != nil {
		return domain.Bot{}, domain.Internal(err)
	}
	sortOrder := int32(0)
	if maxOrder != nil {
		sortOrder = *maxOrder + 1
	}

	tags := input.Tags
	if tags == nil {
		tags = []string{}
	}
	now := s.now()
	bot, err := s.bots.Create(ctx, domain.Bot{
		ID:          uuid.New(),
		UserID:      id,
		Name:        input.Name,
		AvatarURL:   input.AvatarURL,
		Description: input.Description,
		Tags:        tags,
		AutoReply:   input.AutoReply,
		SortOrder:   sortOrder,
		Model:       input.Model,
		AIConfig:    input.AIConfig,
		CreatedAt:   now,
		UpdatedAt:   now,
	})
	if err != nil {
		return domain.Bot{}, domain.Internal(err)
	}
	s.record("create_bot", "bot", bot.ID, "Created bot: "+bot.Name)
	return bot, nil
}

// UpdateBot applies whichever fields were supplied and returns the stored bot.
func (s *BotService) UpdateBot(
	ctx context.Context,
	userID string,
	botID uuid.UUID,
	input UpdateBotInput,
) (domain.Bot, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domain.Bot{}, domain.InvalidUUID(err)
	}

	existing, err := s.bots.ByID(ctx, id, botID)
	if errors.Is(err, domain.ErrNoRows) {
		return domain.Bot{}, domain.BotNotFound()
	}
	if err != nil {
		return domain.Bot{}, domain.Internal(err)
	}

	updated := existing
	if input.Name != nil {
		updated.Name = *input.Name
	}
	if input.Description != nil {
		updated.Description = *input.Description
	}
	if input.AutoReply != nil {
		updated.AutoReply = *input.AutoReply
	}
	if input.SortOrder != nil {
		updated.SortOrder = *input.SortOrder
	}
	if input.SetAvatar {
		updated.AvatarURL = input.AvatarURL
	}
	if input.Tags != nil {
		updated.Tags = *input.Tags
	}
	if input.SetModel {
		updated.Model = input.Model
	}
	if input.SetAIConfig {
		updated.AIConfig = input.AIConfig
	}
	updated.UpdatedAt = s.now()

	saved, err := s.bots.Update(ctx, updated)
	if errors.Is(err, domain.ErrNoRows) {
		return domain.Bot{}, domain.BotNotFound()
	}
	if err != nil {
		return domain.Bot{}, domain.Internal(err)
	}
	s.record("update_bot", "bot", saved.ID, "Updated bot: "+saved.Name)
	return saved, nil
}

// DeleteBot soft-deletes a bot.
func (s *BotService) DeleteBot(ctx context.Context, userID string, botID uuid.UUID) error {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domain.InvalidUUID(err)
	}
	if err := s.bots.SoftDelete(ctx, id, botID, s.now()); err != nil {
		if errors.Is(err, domain.ErrNoRows) {
			return domain.BotNotFound()
		}
		return domain.Internal(err)
	}
	s.record("delete_bot", "bot", botID, "Deleted bot")
	return nil
}

// ReorderBots writes the supplied order as sort_order, starting at zero.
func (s *BotService) ReorderBots(ctx context.Context, userID string, order []uuid.UUID) error {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domain.InvalidUUID(err)
	}
	if err := s.bots.Reorder(ctx, id, order, s.now()); err != nil {
		return domain.Internal(err)
	}
	return nil
}

func (s *BotService) record(action, entity string, id uuid.UUID, detail string) {
	if s.activity == nil {
		return
	}
	entityID := id.String()
	s.activity.RecordInfo(action, entity, &entityID, detail)
}

// GetBotReplies returns the reply forest for a memo, with duplicate auto-roots
// hidden and per-thread counts resolved.
func (s *BotService) GetBotReplies(
	ctx context.Context,
	userID string,
	memoID uuid.UUID,
) ([]domain.BotReplyNode, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, domain.InvalidUUID(err)
	}
	rows, err := s.bots.RepliesForMemo(ctx, id, memoID)
	if err != nil {
		return nil, domain.Internal(err)
	}

	kept, counts, latest := canonicalReplies(rows)
	summaries, err := s.botSummaries(ctx, id, kept)
	if err != nil {
		return nil, err
	}
	return BuildReplyTree(kept, summaries, counts, latest), nil
}

// GetBotThread returns the full linear conversation a reply belongs to.
func (s *BotService) GetBotThread(
	ctx context.Context,
	userID string,
	replyID uuid.UUID,
) (domain.BotThread, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domain.BotThread{}, domain.InvalidUUID(err)
	}
	thread, err := s.loadThread(ctx, id, replyID)
	if err != nil {
		return domain.BotThread{}, err
	}
	return domain.BotThread{
		MemoID:        thread.memoID,
		Bot:           thread.bot,
		Messages:      BuildThreadMessages(thread.replies),
		LatestReplyID: thread.latestReplyID,
	}, nil
}

func (s *BotService) botSummaries(
	ctx context.Context,
	userID uuid.UUID,
	replies []domain.BotReply,
) (map[uuid.UUID]domain.BotSummary, error) {
	seen := make(map[uuid.UUID]struct{})
	ids := make([]uuid.UUID, 0)
	for _, reply := range replies {
		if _, ok := seen[reply.BotID]; ok {
			continue
		}
		seen[reply.BotID] = struct{}{}
		ids = append(ids, reply.BotID)
	}
	if len(ids) == 0 {
		return map[uuid.UUID]domain.BotSummary{}, nil
	}
	summaries, err := s.bots.BotSummariesByID(ctx, userID, ids)
	if err != nil {
		return nil, domain.Internal(err)
	}
	byID := make(map[uuid.UUID]domain.BotSummary, len(summaries))
	for _, summary := range summaries {
		byID[summary.ID] = summary
	}
	return byID, nil
}
