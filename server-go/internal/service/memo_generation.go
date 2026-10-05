package service

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/retry"
)

// generationTimeout bounds one memo's whole generation, matching the previous
// server's 600 second budget.
const generationTimeout = 10 * time.Minute

// GenerationStore is the persistence the background pipeline needs.
type GenerationStore interface {
	Snapshot(ctx context.Context, memoID uuid.UUID) (revision int32, updatedAt int64, found bool, err error)
	ExistingTags(ctx context.Context, userID uuid.UUID) ([]string, error)
	RevisionsUpTo(ctx context.Context, memoID uuid.UUID, maxRevision int32) ([]domain.MemoRevision, error)
	MemoByID(ctx context.Context, memoID uuid.UUID) (domain.Memo, error)
	ApplyGeneratedTags(ctx context.Context, memoID, userID uuid.UUID, revision int32, expectedTags, generatedTags []string, now int64) (bool, error)
	ApplyGeneratedSummary(ctx context.Context, memoID, userID uuid.UUID, revision int32, expectedSummary *string, summary string, now int64) (bool, error)
}

// GenerationEmbedder refreshes a memo's stored embedding. Implementations guard
// against a stale revision themselves.
type GenerationEmbedder interface {
	RefreshForMemo(ctx context.Context, memo domain.Memo, revisionContext string) error
}

// BotTrigger starts the auto-reply fan-out for a memo.
type BotTrigger interface {
	TriggerReplies(ctx context.Context, userID string, memoID uuid.UUID) error
}

// GenerationSettings resolves the auto-tag and auto-summary toggles.
type GenerationSettings interface {
	AutoTagEnabled(ctx context.Context) bool
	AutoSummaryEnabled(ctx context.Context) bool
}

// DiaryQueuer schedules the AI diary job a memo write may have earned.
type DiaryQueuer interface {
	QueueJobForMemo(ctx context.Context, memo domain.Memo) error
}

// MemoChange describes what a write changed, which decides what the pipeline
// runs. It mirrors the flags the previous server derived from the request.
type MemoChange struct {
	// QueueDiary is true when the write also queues an AI diary job, which the
	// previous server did for a new memo and for a content change.
	QueueDiary bool
	// ContentChanged is true when the body was supplied.
	ContentChanged bool
	// AutoTagRequested is true when the caller left tags empty.
	AutoTagRequested bool
	// AutoSummaryRequested is true when the caller supplied no summary.
	AutoSummaryRequested bool
	// EmbeddingRelevant is true when a field feeding the embedding source text
	// changed.
	EmbeddingRelevant bool
}

// MemoPipeline runs the generation a memo write triggers. Implementations must
// return immediately: the work happens off the request path.
type MemoPipeline interface {
	AfterMemoWrite(ctx context.Context, memo domain.Memo, change MemoChange)
}

// NoPipeline is a pipeline that does nothing, for callers that have no
// generation collaborators wired.
type NoPipeline struct{}

// AfterMemoWrite satisfies MemoPipeline.
func (NoPipeline) AfterMemoWrite(context.Context, domain.Memo, MemoChange) {}

// GenerationDeps carries every collaborator the pipeline needs. Each field is
// required except Diaries and Images, which name capabilities an installation
// may not have wired.
type GenerationDeps struct {
	Store        GenerationStore
	Embeddings   GenerationEmbedder
	Bots         BotTrigger
	Images       ImageProvider
	Configs      ChatConfigProvider
	Completions  CompletionClient
	Settings     GenerationSettings
	Diaries      DiaryQueuer
	ParseTags    func(string) ([]string, error)
	SystemPrompt string
}

// MemoGenerationService is the work the previous server spawned after every memo
// write: the embedding refresh, the auto-tag and auto-summary calls, and the
// auto-reply fan-out. Every result is written against the revision it was
// generated from, so a slow generation cannot overwrite a newer edit.
type MemoGenerationService struct {
	store        GenerationStore
	embeddings   GenerationEmbedder
	bots         BotTrigger
	images       ImageProvider
	configs      ChatConfigProvider
	completions  CompletionClient
	settings     GenerationSettings
	diaries      DiaryQueuer
	parseTags    func(string) ([]string, error)
	systemPrompt string
	locks        *memoLocks
	now          func() int64
}

// NewMemoGenerationService wires every collaborator from deps.
func NewMemoGenerationService(deps GenerationDeps) *MemoGenerationService {
	return &MemoGenerationService{
		store:        deps.Store,
		embeddings:   deps.Embeddings,
		bots:         deps.Bots,
		images:       deps.Images,
		configs:      deps.Configs,
		completions:  deps.Completions,
		settings:     deps.Settings,
		diaries:      deps.Diaries,
		parseTags:    deps.ParseTags,
		systemPrompt: deps.SystemPrompt,
		locks:        newMemoLocks(),
		now:          func() int64 { return time.Now().UnixMilli() },
	}
}

// WithClock replaces the timestamp source. Intended for tests.
func (s *MemoGenerationService) WithClock(now func() int64) *MemoGenerationService {
	s.now = now
	return s
}

// AfterMemoWrite starts generation and returns without waiting for it.
func (s *MemoGenerationService) AfterMemoWrite(
	ctx context.Context,
	memo domain.Memo,
	change MemoChange,
) {
	// The work must outlive the request that triggered it.
	detached := context.WithoutCancel(ctx)
	go s.run(detached, memo, change)
}

// run performs one memo's generation under the per-memo guard.
func (s *MemoGenerationService) run(ctx context.Context, memo domain.Memo, change MemoChange) {
	release := s.locks.acquire(memo.ID)
	defer release()

	ctx, cancel := context.WithTimeout(ctx, generationTimeout)
	defer cancel()

	if change.QueueDiary && s.diaries != nil {
		if err := s.diaries.QueueJobForMemo(ctx, memo); err != nil {
			slog.ErrorContext(ctx, "queueing the AI diary job", "memoId", memo.ID, "err", err)
		}
	}

	if !s.current(ctx, memo) {
		slog.InfoContext(ctx, "discarding generation for a superseded revision",
			"memoId", memo.ID, "revision", memo.RevisionCount)
		return
	}

	revisions, err := s.store.RevisionsUpTo(ctx, memo.ID, memo.RevisionCount)
	if err != nil {
		slog.ErrorContext(ctx, "loading revisions for generation", "memoId", memo.ID, "err", err)
		return
	}
	if len(revisions) == 0 {
		slog.WarnContext(ctx, "no revisions to generate from", "memoId", memo.ID)
		return
	}
	revisionContext := BuildRevisionContext(revisions)

	config, err := s.configs.ChatConfig(ctx, memo.UserID)
	if err != nil {
		// Without a usable model configuration the embedding and the bot
		// replies still run; the bot relies on the anchor embedding, so the
		// embedding goes first.
		s.refreshEmbedding(ctx, memo, revisionContext)
		s.triggerBots(ctx, memo, change)
		return
	}

	if s.settings.AutoTagEnabled(ctx) && change.AutoTagRequested && len(memo.Tags) == 0 {
		s.generateTags(ctx, memo, config, revisionContext)
	}
	if s.settings.AutoSummaryEnabled(ctx) && change.AutoSummaryRequested {
		s.generateSummary(ctx, memo, config, revisionContext)
	}

	// Re-read so the embedding is built from the tags and summary just written.
	fresh, err := s.store.MemoByID(ctx, memo.ID)
	if err != nil {
		slog.ErrorContext(ctx, "reloading the memo after generation", "memoId", memo.ID, "err", err)
		return
	}
	if fresh.RevisionCount != memo.RevisionCount {
		slog.InfoContext(ctx, "skipping embedding for a superseded revision",
			"memoId", memo.ID, "revision", memo.RevisionCount)
		return
	}

	s.refreshEmbedding(ctx, fresh, revisionContext)
	s.triggerBots(ctx, fresh, change)
}

// current reports whether the memo still matches the snapshot the generation
// started from.
func (s *MemoGenerationService) current(ctx context.Context, memo domain.Memo) bool {
	revision, updatedAt, found, err := s.store.Snapshot(ctx, memo.ID)
	if err != nil {
		slog.ErrorContext(ctx, "reading the memo snapshot", "memoId", memo.ID, "err", err)
		return false
	}
	return found && revision == memo.RevisionCount && updatedAt == memo.UpdatedAt
}

func (s *MemoGenerationService) refreshEmbedding(
	ctx context.Context,
	memo domain.Memo,
	revisionContext string,
) {
	err := retry.Do(ctx, generationRetryPolicy(30*time.Second), func(attemptCtx context.Context) error {
		return s.embeddings.RefreshForMemo(attemptCtx, memo, revisionContext)
	})
	if err != nil {
		slog.ErrorContext(ctx, "refreshing the embedding", "memoId", memo.ID, "err", err)
	}
}

func (s *MemoGenerationService) triggerBots(ctx context.Context, memo domain.Memo, change MemoChange) {
	if !change.ContentChanged {
		return
	}
	if err := s.bots.TriggerReplies(ctx, memo.UserID.String(), memo.ID); err != nil {
		slog.ErrorContext(ctx, "triggering bot replies", "memoId", memo.ID, "err", err)
	}
}

func (s *MemoGenerationService) generateTags(
	ctx context.Context,
	memo domain.Memo,
	config domain.AIConfig,
	revisionContext string,
) {
	existing, err := s.store.ExistingTags(ctx, memo.UserID)
	if err != nil {
		slog.WarnContext(ctx, "reading existing tags; continuing without a hint",
			"memoId", memo.ID, "err", err)
	}

	result, err := s.complete(ctx, config,
		BuildAutoTagPrompt(existing, revisionContext), s.loadMemoImages(ctx, memo),
		90*time.Second)
	if err != nil {
		slog.ErrorContext(ctx, "generating tags", "memoId", memo.ID, "err", err)
		return
	}

	tags, err := s.parseTags(result)
	if err != nil {
		slog.ErrorContext(ctx, "parsing generated tags", "memoId", memo.ID, "err", err)
		return
	}
	if len(tags) == 0 {
		slog.WarnContext(ctx, "the model returned no usable tags", "memoId", memo.ID)
		return
	}

	applied, err := s.store.ApplyGeneratedTags(
		ctx, memo.ID, memo.UserID, memo.RevisionCount, memo.Tags, tags, s.now())
	if err != nil {
		slog.ErrorContext(ctx, "persisting generated tags", "memoId", memo.ID, "err", err)
		return
	}
	if !applied {
		slog.InfoContext(ctx, "discarded stale generated tags",
			"memoId", memo.ID, "revision", memo.RevisionCount)
	}
}

func (s *MemoGenerationService) generateSummary(
	ctx context.Context,
	memo domain.Memo,
	config domain.AIConfig,
	revisionContext string,
) {
	result, err := s.complete(ctx, config,
		BuildAutoSummaryPrompt(revisionContext), s.loadMemoImages(ctx, memo),
		90*time.Second)
	if err != nil {
		slog.ErrorContext(ctx, "generating a summary", "memoId", memo.ID, "err", err)
		return
	}

	summary := normalizeGeneratedText(result)
	if summary == "" {
		slog.WarnContext(ctx, "the model returned an empty summary", "memoId", memo.ID)
		return
	}

	applied, err := s.store.ApplyGeneratedSummary(
		ctx, memo.ID, memo.UserID, memo.RevisionCount, memo.AiSummary, summary, s.now())
	if err != nil {
		slog.ErrorContext(ctx, "persisting the generated summary", "memoId", memo.ID, "err", err)
		return
	}
	if !applied {
		slog.InfoContext(ctx, "discarded stale generated summary",
			"memoId", memo.ID, "revision", memo.RevisionCount)
	}
}

// memoLocks serialises generation per memo inside one process. Serialising
// across processes is the advisory lock's job.
type memoLocks struct {
	mu   sync.Mutex
	held map[uuid.UUID]*memoLock
}

type memoLock struct {
	mu   sync.Mutex
	refs int
}

func newMemoLocks() *memoLocks {
	return &memoLocks{held: map[uuid.UUID]*memoLock{}}
}

// acquire blocks until this memo's generation slot is free and returns the
// release function. Reference counting keeps the map bounded: an entry is
// dropped once no holder or waiter remains.
func (l *memoLocks) acquire(memoID uuid.UUID) func() {
	l.mu.Lock()
	entry, ok := l.held[memoID]
	if !ok {
		entry = &memoLock{}
		l.held[memoID] = entry
	}
	entry.refs++
	l.mu.Unlock()

	entry.mu.Lock()

	return func() {
		entry.mu.Unlock()

		l.mu.Lock()
		entry.refs--
		if entry.refs == 0 {
			delete(l.held, memoID)
		}
		l.mu.Unlock()
	}
}

// generationRetryPolicy is the previous server's backoff with the embedding
// call's shorter per-attempt timeout.
func generationRetryPolicy(timeout time.Duration) retry.Policy {
	policy := retry.DefaultPolicy()
	policy.Timeout = timeout
	return policy
}
