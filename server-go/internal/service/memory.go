package service

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// Retrieval tuning, unchanged from the previous server.
const (
	retrievalRecentDays         = 30
	maxRetrievalCandidates      = 30
	minSemanticScore            = 0.55
	maxRelatedMemos             = 30
	maxMemoryPrefixChars        = 1600
	maxRetrievalExcerptRunes    = 120
	defaultMemoryActivityLimit  = int32(20)
	maxMemoryActivityLimit      = int32(50)
	semanticWeightMemoryRanking = 0.55
	recencyWeightMemoryRanking  = 0.25
	relevanceWeightTagOverlap   = 0.20
	semanticReasonThreshold     = 0.3
	recentReasonThreshold       = 0.5
)

// Hybrid search fusion weights, unchanged from the previous server.
const (
	hybridSemanticWeight   = 0.6
	hybridKeywordWeight    = 0.4
	hybridMinimumFinal     = 0.2
	hybridSemanticCutoff   = 0.4
	hybridKeywordRowLimit  = 200
	hybridSemanticRowLimit = 50
)

// MemoryScore is one memo's fused relevance, persisted with a debug log.
type MemoryScore struct {
	MemoID uuid.UUID
	Score  float64
	Reason string
}

// MemoryDebugLog is a persisted record of how one bot's context was assembled.
type MemoryDebugLog struct {
	ID               uuid.UUID
	BotID            uuid.UUID
	RetrievedMemoIDs []uuid.UUID
	Scores           []MemoryScore
	PromptSize       int32
	CreatedAt        int64
}

// MemoryActivityEntry is one row of the retrieval activity feed.
type MemoryActivityEntry struct {
	ID             uuid.UUID
	BotID          uuid.UUID
	BotName        string
	MemoID         uuid.UUID
	RetrievedCount int64
	PromptSize     int32
	CreatedAt      int64
}

// MemoryStore is the persistence the memory service depends on.
type MemoryStore interface {
	Stats(ctx context.Context, userID uuid.UUID) (domain.MemoryStats, error)
	Activity(ctx context.Context, userID uuid.UUID, limit int32) ([]MemoryActivityEntry, error)
	LatestDebugLog(ctx context.Context, userID, memoID, botID uuid.UUID) (MemoryDebugLog, bool, error)
	DebugLogsForMemo(ctx context.Context, userID, memoID uuid.UUID) ([]MemoryDebugLog, error)
	MemosByIDs(ctx context.Context, ids []uuid.UUID) ([]domain.Memo, error)
	SaveDebugLog(ctx context.Context, userID, memoID uuid.UUID, log MemoryDebugLog) error
	RetrievalCandidates(
		ctx context.Context,
		userID, anchorMemoID uuid.UUID,
		recentCutoffMs int64,
	) ([]domain.MemoryCandidate, error)
}

// MemoryService assembles and reports the memory background a bot is given.
type MemoryService struct {
	store MemoryStore
	now   func() int64
}

func NewMemoryService(store MemoryStore) *MemoryService {
	return &MemoryService{store: store, now: func() int64 { return time.Now().UnixMilli() }}
}

// WithClock replaces the clock. Intended for tests that pin retention windows.
func (s *MemoryService) WithClock(now func() int64) *MemoryService {
	s.now = now
	return s
}

// Stats reports how many of a user's memos carry embeddings.
func (s *MemoryService) Stats(ctx context.Context, userID string) (domain.MemoryStats, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domain.MemoryStats{}, domain.InvalidUUID(err)
	}
	stats, err := s.store.Stats(ctx, id)
	if err != nil {
		return domain.MemoryStats{}, domain.Internal(err)
	}
	return stats, nil
}

// Activity returns the most recent context builds for a user.
func (s *MemoryService) Activity(
	ctx context.Context,
	userID string,
	limit int32,
) ([]MemoryActivityEntry, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, domain.InvalidUUID(err)
	}
	if limit <= 0 {
		limit = defaultMemoryActivityLimit
	}
	if limit > maxMemoryActivityLimit {
		limit = maxMemoryActivityLimit
	}
	entries, err := s.store.Activity(ctx, id, limit)
	if err != nil {
		return nil, domain.Internal(err)
	}
	return entries, nil
}

// Context returns the memos recorded for one memo+bot, newest log first.
func (s *MemoryService) Context(
	ctx context.Context,
	userID string,
	memoID, botID uuid.UUID,
	limit *int,
) ([]domain.RelatedMemoContext, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, domain.InvalidUUID(err)
	}
	log, found, err := s.store.LatestDebugLog(ctx, id, memoID, botID)
	if err != nil {
		return nil, domain.Internal(err)
	}
	if !found || len(log.RetrievedMemoIDs) == 0 {
		return []domain.RelatedMemoContext{}, nil
	}
	memos, err := s.store.MemosByIDs(ctx, log.RetrievedMemoIDs)
	if err != nil {
		return nil, domain.Internal(err)
	}
	return AssembleRetrievedMemos(log, memos, limit), nil
}

// MemoContexts returns every bot's recorded context for one memo, keyed by bot.
func (s *MemoryService) MemoContexts(
	ctx context.Context,
	userID string,
	memoID uuid.UUID,
	limit *int,
) (map[uuid.UUID][]domain.RelatedMemoContext, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, domain.InvalidUUID(err)
	}
	logs, err := s.store.DebugLogsForMemo(ctx, id, memoID)
	if err != nil {
		return nil, domain.Internal(err)
	}
	contexts := make(map[uuid.UUID][]domain.RelatedMemoContext, len(logs))
	if len(logs) == 0 {
		return contexts, nil
	}

	unique := make([]uuid.UUID, 0)
	seen := make(map[uuid.UUID]struct{})
	for _, log := range logs {
		for _, memoID := range log.RetrievedMemoIDs {
			if _, ok := seen[memoID]; ok {
				continue
			}
			seen[memoID] = struct{}{}
			unique = append(unique, memoID)
		}
	}
	memos, err := s.store.MemosByIDs(ctx, unique)
	if err != nil {
		return nil, domain.Internal(err)
	}
	byID := make(map[uuid.UUID]domain.Memo, len(memos))
	for _, memo := range memos {
		byID[memo.ID] = memo
	}

	for _, log := range logs {
		ordered := make([]domain.Memo, 0, len(log.RetrievedMemoIDs))
		for _, memoID := range log.RetrievedMemoIDs {
			memo, ok := byID[memoID]
			if !ok {
				continue
			}
			ordered = append(ordered, memo)
		}
		contexts[log.BotID] = AssembleRetrievedMemos(log, ordered, limit)
	}
	return contexts, nil
}

// AssembleContext builds the live memory background for a memo without reading
// a debug log. The memo is fetched so callers only need its identifier.
func (s *MemoryService) AssembleContext(
	ctx context.Context,
	userID string,
	memoID uuid.UUID,
) (domain.BotMemoryContext, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domain.BotMemoryContext{}, domain.InvalidUUID(err)
	}
	memos, err := s.store.MemosByIDs(ctx, []uuid.UUID{memoID})
	if err != nil {
		return domain.BotMemoryContext{}, domain.Internal(err)
	}
	for _, memo := range memos {
		if memo.ID == memoID && memo.UserID == id {
			return s.BuildForMemo(ctx, memo)
		}
	}
	return domain.BotMemoryContext{SimilarMemos: []domain.RelatedMemoContext{}}, nil
}

// BuildForMemo retrieves and ranks the memos related to an anchor memo.
func (s *MemoryService) BuildForMemo(
	ctx context.Context,
	memo domain.Memo,
) (domain.BotMemoryContext, error) {
	nowMs := s.now()
	recentCutoff := nowMs - retrievalRecentDays*86_400_000
	candidates, err := s.store.RetrievalCandidates(ctx, memo.UserID, memo.ID, recentCutoff)
	if err != nil {
		return domain.BotMemoryContext{}, domain.Internal(err)
	}
	similar := RankCandidates(memo.Tags, candidates, nowMs, maxRelatedMemos)
	if similar == nil {
		similar = []domain.RelatedMemoContext{}
	}
	return domain.BotMemoryContext{SimilarMemos: similar, Debug: BuildDebugContext(similar)}, nil
}

// PersistForBot stores the debug log for one bot's assembled context.
func (s *MemoryService) PersistForBot(
	ctx context.Context,
	userID, memoID, botID uuid.UUID,
	memoryContext domain.BotMemoryContext,
) error {
	log := MemoryDebugLog{
		BotID:            botID,
		RetrievedMemoIDs: memoryContext.Debug.RetrievedMemoIDs,
		Scores:           scoresFor(memoryContext.SimilarMemos),
		PromptSize:       int32(memoryContext.Debug.PromptChars),
		CreatedAt:        s.now(),
	}
	if err := s.store.SaveDebugLog(ctx, userID, memoID, log); err != nil {
		return domain.Internal(err)
	}
	return nil
}

func scoresFor(memos []domain.RelatedMemoContext) []MemoryScore {
	scores := make([]MemoryScore, 0, len(memos))
	for _, memo := range memos {
		scores = append(scores, MemoryScore{
			MemoID: memo.MemoID,
			Score:  memo.RelevanceScore,
			Reason: memo.Reason,
		})
	}
	return scores
}
