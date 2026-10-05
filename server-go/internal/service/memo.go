package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// MemoStore is the persistence the memo service depends on. It is declared at
// the consumer so the service can be exercised against an in-memory fake.
type MemoStore interface {
	Create(ctx context.Context, memo domain.Memo, initial domain.MemoRevision) (domain.Memo, error)
	ByID(ctx context.Context, userID, memoID uuid.UUID) (domain.Memo, error)
	Update(
		ctx context.Context,
		userID, memoID uuid.UUID,
		content *string,
		tags *[]string,
		isArchived *bool,
		diaryDate *domain.Date,
		clearDiaryDate bool,
		aiSummary *string,
		now int64,
	) (domain.Memo, error)
	SoftDelete(ctx context.Context, userID, memoID uuid.UUID, now int64) error
	SetArchived(ctx context.Context, userID, memoID uuid.UUID, archived bool, diaryDate *domain.Date, now int64) error
	List(ctx context.Context, userID uuid.UUID, filter domain.MemoListFilter, offset uint32) ([]domain.Memo, int64, error)
	ByCreatedDate(ctx context.Context, userID uuid.UUID, startMS, endMS int64, archived *bool) ([]domain.Memo, error)
	Search(ctx context.Context, userID uuid.UUID, query domain.MemoSearchQuery, fromMS, toMS *int64, offset uint32) ([]domain.Memo, int64, error)
	TagCounts(ctx context.Context, userID uuid.UUID) ([]domain.TagCount, error)
	Revisions(ctx context.Context, userID, memoID uuid.UUID) ([]domain.MemoRevision, error)
	DeleteRevision(ctx context.Context, userID, memoID, revisionID uuid.UUID, now int64) error
	ResourcesForMemo(ctx context.Context, memoID uuid.UUID) ([]domain.Resource, error)
	ResourcesForMemos(ctx context.Context, memoIDs []uuid.UUID) (map[uuid.UUID][]domain.Resource, error)
	AssociateResources(ctx context.Context, memoID uuid.UUID, resourceIDs []uuid.UUID) error
	ReplaceResources(ctx context.Context, memoID uuid.UUID, resourceIDs []uuid.UUID, now int64) error
}

// BotReplyTreeReader loads the replies a bot produced for a memo as a nested
// tree. The bot module owns the assembly; the memo service only needs the
// result for the detail endpoint.
type BotReplyTreeReader interface {
	GetBotReplies(ctx context.Context, userID string, memoID uuid.UUID) ([]domain.BotReplyNode, error)
}

// records an explicit null, which detaches the memo from a diary day.
type UpdateMemoInput struct {
	Content        *string
	Tags           *[]string
	ResourceIDs    *[]string
	IsArchived     *bool
	DiaryDate      *domain.Date
	ClearDiaryDate bool
	AiSummary      *string
}

// MemoService implements the memo module's business rules.
type MemoService struct {
	memos       MemoStore
	botReplies  BotReplyTreeReader
	clips       ClipFetcher
	timezone    func(context.Context) *time.Location
	pipeline    MemoPipeline
	configs     ChatConfigProvider
	completions CompletionClient
	images      ImageProvider
	now         func() int64
}

// NewMemoService wires every collaborator as a required argument. A nil
// timezone falls back to the previous server's Asia/Shanghai default.
func NewMemoService(
	memos MemoStore,
	botReplies BotReplyTreeReader,
	clips ClipFetcher,
	timezone *time.Location,
	pipeline MemoPipeline,
	configs ChatConfigProvider,
	completions CompletionClient,
	images ImageProvider,
) *MemoService {
	fixed := orShanghai(timezone)
	return &MemoService{
		memos:       memos,
		botReplies:  botReplies,
		clips:       clips,
		timezone:    func(context.Context) *time.Location { return fixed },
		pipeline:    pipeline,
		configs:     configs,
		completions: completions,
		images:      images,
		now:         func() int64 { return time.Now().UnixMilli() },
	}
}

// WithTimezoneProvider resolves the application timezone per request, so an
// administrator changing it takes effect without a restart. A nil provider
// leaves the fixed location in place.
func (s *MemoService) WithTimezoneProvider(provider func(context.Context) *time.Location) *MemoService {
	if provider != nil {
		s.timezone = provider
	}
	return s
}

// startGeneration hands a written memo to the background pipeline. It returns
// immediately so generation never delays the response, mirroring the previous
// server's fire-and-forget spawn.
func (s *MemoService) startGeneration(ctx context.Context, memo domain.Memo, change MemoChange) {
	if s.pipeline == nil {
		return
	}
	s.pipeline.AfterMemoWrite(ctx, memo, change)
}

// WithClock replaces the timestamp source. Intended for tests.
func (s *MemoService) WithClock(now func() int64) *MemoService {
	s.now = now
	return s
}

// Create stores a memo and its first revision, then attaches any resources the
// request named.
func (s *MemoService) Create(ctx context.Context, userID string, input CreateMemoInput) (MemoWithResources, error) {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return MemoWithResources{}, domain.InvalidUUID(err)
	}

	now := s.now()
	memo := domain.Memo{
		ID:            uuid.New(),
		UserID:        userUUID,
		Content:       input.Content,
		Tags:          memoNonNilTags(input.Tags),
		DiaryDate:     input.DiaryDate,
		AiSummary:     input.AiSummary,
		CreatedAt:     now,
		UpdatedAt:     now,
		RevisionCount: domain.DefaultRevisionCount,
	}

	created, err := s.memos.Create(ctx, memo, InitialRevision(memo))
	if err := translate(err); err != nil {
		return MemoWithResources{}, err
	}

	if len(input.ResourceIDs) > 0 {
		if err := translate(s.memos.AssociateResources(ctx, created.ID, ParseUUIDList(input.ResourceIDs))); err != nil {
			return MemoWithResources{}, err
		}
	}

	s.startGeneration(ctx, created, MemoChange{
		QueueDiary:           true,
		ContentChanged:       true,
		AutoTagRequested:     len(input.Tags) == 0,
		AutoSummaryRequested: input.AiSummary == nil,
		EmbeddingRelevant:    true,
	})

	return s.withResources(ctx, created)
}

// Get returns one memo with its resources.
func (s *MemoService) Get(ctx context.Context, userID string, memoID uuid.UUID) (MemoWithResources, error) {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return MemoWithResources{}, domain.InvalidUUID(err)
	}

	memo, err := s.memos.ByID(ctx, userUUID, memoID)
	if err := translate(err); err != nil {
		return MemoWithResources{}, err
	}
	return s.withResources(ctx, memo)
}

// List pages through the user's memos, attaching resources to each.
func (s *MemoService) List(ctx context.Context, userID string, filter domain.MemoListFilter) (domain.Paginated[MemoWithResources], error) {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return domain.Paginated[MemoWithResources]{}, domain.InvalidUUID(err)
	}

	page, pageSize := domain.NormalizePage(filter.Page, filter.PageSize, defaultListPageSize)
	filter.Page, filter.PageSize = page, pageSize

	rows, total, err := s.memos.List(ctx, userUUID, filter, (page-1)*pageSize)
	if err := translate(err); err != nil {
		return domain.Paginated[MemoWithResources]{}, err
	}

	items, err := s.attachResources(ctx, rows)
	if err != nil {
		return domain.Paginated[MemoWithResources]{}, err
	}
	return domain.NewPaginated(items, total, page, pageSize), nil
}

// Tags returns every tag the user has used and how many memos carry it.
func (s *MemoService) Tags(ctx context.Context, userID string) ([]domain.TagCount, error) {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, domain.InvalidUUID(err)
	}
	tags, err := s.memos.TagCounts(ctx, userUUID)
	if err := translate(err); err != nil {
		return nil, err
	}
	if tags == nil {
		tags = []domain.TagCount{}
	}
	return tags, nil
}

// Search filters memos by keyword, tags and creation date.
func (s *MemoService) Search(ctx context.Context, userID string, query domain.MemoSearchQuery) (domain.Paginated[MemoWithResources], error) {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return domain.Paginated[MemoWithResources]{}, domain.InvalidUUID(err)
	}

	page, pageSize := domain.NormalizePage(query.Page, query.PageSize, defaultSearchPageSize)
	query.Page, query.PageSize = page, pageSize

	fromMS, toMS, err := s.searchBounds(ctx, query)
	if err != nil {
		return domain.Paginated[MemoWithResources]{}, err
	}

	rows, total, err := s.memos.Search(ctx, userUUID, query, fromMS, toMS, (page-1)*pageSize)
	if err := translate(err); err != nil {
		return domain.Paginated[MemoWithResources]{}, err
	}

	items, err := s.attachResources(ctx, rows)
	if err != nil {
		return domain.Paginated[MemoWithResources]{}, err
	}
	return domain.NewPaginated(items, total, page, pageSize), nil
}

// ByCreatedDate returns the memos created on a calendar day in the user's
// timezone.
func (s *MemoService) ByCreatedDate(ctx context.Context, userID, date string, archived *bool) ([]MemoWithResources, error) {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, domain.InvalidUUID(err)
	}

	startMS, endMS, err := DateBounds(date, s.timezone(ctx))
	if err != nil {
		return nil, err
	}

	rows, err := s.memos.ByCreatedDate(ctx, userUUID, startMS, endMS, archived)
	if err := translate(err); err != nil {
		return nil, err
	}
	return s.attachResources(ctx, rows)
}

// Update applies the supplied fields and records a revision when the content
// changed.
func (s *MemoService) Update(ctx context.Context, userID string, memoID uuid.UUID, input UpdateMemoInput) (MemoWithResources, error) {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return MemoWithResources{}, domain.InvalidUUID(err)
	}

	memo, err := s.memos.Update(ctx, userUUID, memoID, input.Content, input.Tags,
		input.IsArchived, input.DiaryDate, input.ClearDiaryDate, input.AiSummary, s.now())
	if err := translate(err); err != nil {
		return MemoWithResources{}, err
	}

	if input.ResourceIDs != nil {
		ids := ParseUUIDList(*input.ResourceIDs)
		if err := translate(s.memos.ReplaceResources(ctx, memo.ID, ids, s.now())); err != nil {
			return MemoWithResources{}, err
		}
	}

	s.startGenerationForUpdate(ctx, memo, input)
	return s.withResources(ctx, memo)
}

// startGenerationForUpdate derives the pipeline flags from what the request
// changed. It reproduces the previous server's three trigger cases: a content
// change runs everything and queues the diary job; an explicitly emptied tag
// list asks only for tagging; and a change to any field that feeds the
// embedding source text refreshes the embedding alone.
func (s *MemoService) startGenerationForUpdate(
	ctx context.Context,
	memo domain.Memo,
	input UpdateMemoInput,
) {
	contentChanged := input.Content != nil
	emptyTags := input.Tags != nil && len(*input.Tags) == 0
	embeddingRelevant := input.Content != nil || input.Tags != nil ||
		input.AiSummary != nil || input.ResourceIDs != nil

	switch {
	case contentChanged:
		s.startGeneration(ctx, memo, MemoChange{
			QueueDiary:           true,
			ContentChanged:       true,
			AutoTagRequested:     input.Tags == nil || len(*input.Tags) == 0,
			AutoSummaryRequested: input.AiSummary == nil,
			EmbeddingRelevant:    true,
		})
	case emptyTags:
		s.startGeneration(ctx, memo, MemoChange{AutoTagRequested: true})
	case embeddingRelevant:
		s.startGeneration(ctx, memo, MemoChange{EmbeddingRelevant: true})
	}
}

// Delete soft-deletes a memo.
func (s *MemoService) Delete(ctx context.Context, userID string, memoID uuid.UUID) error {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return domain.InvalidUUID(err)
	}
	return translate(s.memos.SoftDelete(ctx, userUUID, memoID, s.now()))
}

// Archive marks a memo as archived, optionally pinning it to a diary day.
func (s *MemoService) Archive(ctx context.Context, userID string, memoID uuid.UUID, diaryDate *domain.Date) error {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return domain.InvalidUUID(err)
	}
	return translate(s.memos.SetArchived(ctx, userUUID, memoID, true, diaryDate, s.now()))
}

// Unarchive clears a memo's archived flag.
func (s *MemoService) Unarchive(ctx context.Context, userID string, memoID uuid.UUID) error {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return domain.InvalidUUID(err)
	}
	return translate(s.memos.SetArchived(ctx, userUUID, memoID, false, nil, s.now()))
}

// Revisions returns a memo's edit history in revision order.
func (s *MemoService) Revisions(ctx context.Context, userID string, memoID uuid.UUID) ([]domain.MemoRevision, error) {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, domain.InvalidUUID(err)
	}
	revisions, err := s.memos.Revisions(ctx, userUUID, memoID)
	if err := translate(err); err != nil {
		return nil, err
	}
	if revisions == nil {
		revisions = []domain.MemoRevision{}
	}
	return revisions, nil
}

// DeleteRevision removes one historical revision. The last remaining revision
// cannot be deleted; the memo must be deleted instead.
func (s *MemoService) DeleteRevision(ctx context.Context, userID string, memoID, revisionID uuid.UUID) error {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return domain.InvalidUUID(err)
	}
	return translate(s.memos.DeleteRevision(ctx, userUUID, memoID, revisionID, s.now()))
}

// Detail bundles a memo with its revisions and bot replies.
func (s *MemoService) Detail(ctx context.Context, userID string, memoID uuid.UUID) (domain.MemoDetail, error) {
	memo, err := s.Get(ctx, userID, memoID)
	if err != nil {
		return domain.MemoDetail{}, err
	}

	revisions, err := s.Revisions(ctx, userID, memoID)
	if err != nil {
		return domain.MemoDetail{}, err
	}

	replies, err := s.botReplies.GetBotReplies(ctx, userID, memoID)
	if err := translate(err); err != nil {
		return domain.MemoDetail{}, err
	}
	if replies == nil {
		replies = []domain.BotReplyNode{}
	}

	return domain.MemoDetail{
		Memo:       memo.Memo,
		Resources:  memo.Resources,
		Revisions:  revisions,
		BotReplies: replies,
	}, nil
}

func (s *MemoService) withResources(ctx context.Context, memo domain.Memo) (MemoWithResources, error) {
	resources, err := s.memos.ResourcesForMemo(ctx, memo.ID)
	if err := translate(err); err != nil {
		return MemoWithResources{}, err
	}
	return MemoWithResources{Memo: memo, Resources: nonNilResources(resources)}, nil
}

func (s *MemoService) attachResources(ctx context.Context, memos []domain.Memo) ([]MemoWithResources, error) {
	ids := make([]uuid.UUID, len(memos))
	for i, memo := range memos {
		ids[i] = memo.ID
	}

	byMemo, err := s.memos.ResourcesForMemos(ctx, ids)
	if err := translate(err); err != nil {
		return nil, err
	}

	out := make([]MemoWithResources, 0, len(memos))
	for _, memo := range memos {
		out = append(out, MemoWithResources{Memo: memo, Resources: nonNilResources(byMemo[memo.ID])})
	}
	return out, nil
}

func (s *MemoService) searchBounds(ctx context.Context, query domain.MemoSearchQuery) (fromMS, toMS *int64, err error) {
	if query.StartDate != nil {
		start, _, err := DateBounds(*query.StartDate, s.timezone(ctx))
		if err != nil {
			return nil, nil, err
		}
		fromMS = &start
	}
	if query.EndDate != nil {
		_, end, err := DateBounds(*query.EndDate, s.timezone(ctx))
		if err != nil {
			return nil, nil, err
		}
		toMS = &end
	}
	return fromMS, toMS, nil
}

// DateBounds converts a YYYY-MM-DD calendar day into the half-open
// [start, end) millisecond window observed in loc.
func DateBounds(date string, loc *time.Location) (int64, int64, error) {
	parsed, err := time.ParseInLocation(domain.DateLayout, date, loc)
	if err != nil {
		return 0, 0, domain.InvalidInputf("invalid date: %s", date)
	}
	start := time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 0, 0, 0, 0, loc)
	return start.UnixMilli(), start.AddDate(0, 0, 1).UnixMilli(), nil
}

// InitialRevision is the first history row written alongside a new memo.
func InitialRevision(memo domain.Memo) domain.MemoRevision {
	return domain.MemoRevision{
		ID:             uuid.New(),
		MemoID:         memo.ID,
		UserID:         memo.UserID,
		RevisionNumber: domain.DefaultRevisionCount,
		Content:        memo.Content,
		Tags:           memoNonNilTags(memo.Tags),
		AiSummary:      memo.AiSummary,
		CreatedAt:      memo.CreatedAt,
	}
}

// ParseUUIDList parses the ids it recognises and skips the rest, matching the
// previous server's tolerance for stale client references.
func ParseUUIDList(values []string) []uuid.UUID {
	out := make([]uuid.UUID, 0, len(values))
	for _, value := range values {
		if id, err := uuid.Parse(value); err == nil {
			out = append(out, id)
		}
	}
	return out
}

const (
	defaultListPageSize   = 20
	defaultSearchPageSize = 50
)

func memoNonNilTags(tags []string) []string {
	if tags == nil {
		return []string{}
	}
	return tags
}

func nonNilResources(resources []domain.Resource) []domain.Resource {
	if resources == nil {
		return []domain.Resource{}
	}
	return resources
}

func orShanghai(loc *time.Location) *time.Location {
	if loc != nil {
		return loc
	}
	if loaded, err := time.LoadLocation("Asia/Shanghai"); err == nil {
		return loaded
	}
	return time.FixedZone("CST", 8*60*60)
}

// translate normalises a store error: a missing row becomes MemoNotFound, an
// existing *domain.Error is preserved, and anything else is internal.
func translate(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, domain.ErrNoRows) {
		return domain.MemoNotFound()
	}
	var domainErr *domain.Error
	if errors.As(err, &domainErr) {
		return err
	}
	return domain.Internal(err)
}
