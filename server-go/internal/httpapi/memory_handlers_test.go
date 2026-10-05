package httpapi

import (
	"context"
	"net/http"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

func TestMemoryStatsAndActivity(t *testing.T) {
	userID := uuid.New()
	store := newFakeMemoryStore()
	store.stats = domain.MemoryStats{TotalMemos: 7, IndexedMemos: 3}
	botID, memoID := uuid.New(), uuid.New()
	store.activity = []service.MemoryActivityEntry{{
		ID: uuid.New(), BotID: botID, BotName: "Muse", MemoID: memoID,
		RetrievedCount: 5, PromptSize: 1234, CreatedAt: 1_700_000_000_000,
	}}
	router := newMemoryTestRouter(store)
	token := botToken(t, userID)

	stats := getWithToken(t, router, "/memory/stats", token)
	if stats.Code != http.StatusOK {
		t.Fatalf("stats status = %d (body %s)", stats.Code, stats.Body)
	}
	var statsBody memoryStatsResponse
	decodeBody(t, stats, &statsBody)
	if statsBody.TotalMemos != 7 || statsBody.IndexedMemos != 3 {
		t.Errorf("stats = %+v", statsBody)
	}

	activity := getWithToken(t, router, "/memory/activity?limit=5", token)
	if activity.Code != http.StatusOK {
		t.Fatalf("activity status = %d (body %s)", activity.Code, activity.Body)
	}
	var entries []memoryActivityEntryResponse
	decodeBody(t, activity, &entries)
	if len(entries) != 1 {
		t.Fatalf("activity entries = %d, want 1", len(entries))
	}
	entry := entries[0]
	if entry.BotID != botID.String() || entry.BotName != "Muse" ||
		entry.MemoID != memoID.String() || entry.RetrievedCount != 5 ||
		entry.PromptSize != 1234 || entry.CreatedAt != 1_700_000_000_000 {
		t.Errorf("entry = %+v", entry)
	}
}

func TestMemoryContextReturnsSimilarMemosAndDebug(t *testing.T) {
	userID := uuid.New()
	memoID, botID := uuid.New(), uuid.New()
	now := int64(1_700_000_000_000)

	store := newFakeMemoryStore()
	store.now = now
	store.memos[memoID] = domain.Memo{
		ID: memoID, UserID: userID, Content: "anchor", CreatedAt: now,
	}
	first := uuid.New()
	second := uuid.New()
	summary := "sum1"
	store.memos[first] = domain.Memo{
		ID: first, UserID: userID, AiSummary: &summary, CreatedAt: now,
	}
	store.memos[second] = domain.Memo{
		ID: second, UserID: userID, Content: "content two", CreatedAt: now - 1000,
	}
	store.latest[[2]uuid.UUID{memoID, botID}] = service.MemoryDebugLog{
		BotID:            botID,
		RetrievedMemoIDs: []uuid.UUID{first, second},
		Scores: []service.MemoryScore{
			{MemoID: first, Score: 0.9, Reason: "semantic"},
			{MemoID: second, Score: 0.4, Reason: "recent"},
		},
		PromptSize: 42,
		CreatedAt:  now,
	}
	store.candidates = []domain.MemoryCandidate{
		{MemoID: uuid.New(), Content: "relevance", VectorScore: 0.8, CreatedAt: now},
		{MemoID: uuid.New(), Content: "weak", VectorScore: 0.1, CreatedAt: now},
	}

	router := newMemoryTestRouter(store)
	token := botToken(t, userID)

	rec := getWithToken(t, router,
		"/memory/context?memoId="+memoID.String()+"&botId="+botID.String()+"&limit=10", token)
	if rec.Code != http.StatusOK {
		t.Fatalf("context status = %d (body %s)", rec.Code, rec.Body)
	}
	var body memoryContextResponse
	decodeBody(t, rec, &body)

	if len(body.RetrievedMemos) != 2 {
		t.Fatalf("retrievedMemos = %d, want 2", len(body.RetrievedMemos))
	}
	if body.RetrievedMemos[0].ID != first.String() ||
		body.RetrievedMemos[0].Excerpt != "sum1" ||
		body.RetrievedMemos[0].Score != 0.9 ||
		body.RetrievedMemos[0].Reason != "semantic" {
		t.Errorf("first retrieved = %+v", body.RetrievedMemos[0])
	}

	if len(body.SimilarMemos) != 1 {
		t.Fatalf("similarMemos = %d, want 1", len(body.SimilarMemos))
	}
	if body.SimilarMemos[0].Excerpt != "relevance" {
		t.Errorf("similar excerpt = %q", body.SimilarMemos[0].Excerpt)
	}
	if body.Debug.CandidateCount != 1 {
		t.Errorf("debug candidateCount = %d, want 1", body.Debug.CandidateCount)
	}
	if len(body.Debug.RetrievedMemoIDs) != 1 {
		t.Errorf("debug retrievedMemoIds = %v", body.Debug.RetrievedMemoIDs)
	}
	if body.Debug.PromptChars != len("relevance")+4 {
		t.Errorf("debug promptChars = %d, want %d", body.Debug.PromptChars, len("relevance")+4)
	}
}

func TestMemoMemoryContextsGroupsByBot(t *testing.T) {
	userID := uuid.New()
	memoID := uuid.New()
	botA, botB := uuid.New(), uuid.New()
	memoA := uuid.New()

	store := newFakeMemoryStore()
	store.memos[memoA] = domain.Memo{ID: memoA, UserID: userID, Content: "hello"}
	store.logsForMemo[memoID] = []service.MemoryDebugLog{
		{BotID: botA, RetrievedMemoIDs: []uuid.UUID{memoA}},
		{BotID: botB, RetrievedMemoIDs: []uuid.UUID{memoA}},
	}

	router := newMemoryTestRouter(store)
	token := botToken(t, userID)

	rec := getWithToken(t, router, "/memos/"+memoID.String()+"/memory-contexts", token)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (body %s)", rec.Code, rec.Body)
	}
	var body memoMemoryContextsResponse
	decodeBody(t, rec, &body)
	if len(body.Contexts) != 2 {
		t.Fatalf("contexts = %d, want 2", len(body.Contexts))
	}
	context, ok := body.Contexts[botA.String()]
	if !ok || len(context.RetrievedMemos) != 1 ||
		context.RetrievedMemos[0].ID != memoA.String() {
		t.Errorf("context for bot A = %+v", context)
	}
}

func TestMemoryContextRequiresIDs(t *testing.T) {
	store := newFakeMemoryStore()
	router := newMemoryTestRouter(store)
	token := botToken(t, uuid.New())

	rec := getWithToken(t, router, "/memory/context", token)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body %s)", rec.Code, rec.Body)
	}
	var body errorBody
	decodeBody(t, rec, &body)
	// The previous server read this parameter as memo_id, and the shipped
	// client sends that spelling, so that is the name the rejection reports.
	if body.Message != "Invalid input: memo_id is required" {
		t.Errorf("message = %q", body.Message)
	}
}

func newMemoryTestRouter(store *fakeMemoryStore) http.Handler {
	svc := service.NewMemoryService(store).WithClock(func() int64 { return store.now })
	router := chi.NewRouter()
	router.Group(func(r chi.Router) {
		r.Use(RequireAuth(routerSecret))
		registerMemoryRoutes(r, svc)
	})
	return router
}

type fakeMemoryStore struct {
	now           int64
	stats         domain.MemoryStats
	activity      []service.MemoryActivityEntry
	latest        map[[2]uuid.UUID]service.MemoryDebugLog
	logsForMemo   map[uuid.UUID][]service.MemoryDebugLog
	memos         map[uuid.UUID]domain.Memo
	candidates    []domain.MemoryCandidate
	savedDebugLog []service.MemoryDebugLog
}

func newFakeMemoryStore() *fakeMemoryStore {
	return &fakeMemoryStore{
		latest:      make(map[[2]uuid.UUID]service.MemoryDebugLog),
		logsForMemo: make(map[uuid.UUID][]service.MemoryDebugLog),
		memos:       make(map[uuid.UUID]domain.Memo),
	}
}

func (f *fakeMemoryStore) Stats(_ context.Context, _ uuid.UUID) (domain.MemoryStats, error) {
	return f.stats, nil
}

func (f *fakeMemoryStore) Activity(
	_ context.Context,
	_ uuid.UUID,
	_ int32,
) ([]service.MemoryActivityEntry, error) {
	return f.activity, nil
}

func (f *fakeMemoryStore) LatestDebugLog(
	_ context.Context,
	_, memoID, botID uuid.UUID,
) (service.MemoryDebugLog, bool, error) {
	log, ok := f.latest[[2]uuid.UUID{memoID, botID}]
	return log, ok, nil
}

func (f *fakeMemoryStore) DebugLogsForMemo(
	_ context.Context,
	_, memoID uuid.UUID,
) ([]service.MemoryDebugLog, error) {
	return f.logsForMemo[memoID], nil
}

func (f *fakeMemoryStore) MemosByIDs(
	_ context.Context,
	ids []uuid.UUID,
) ([]domain.Memo, error) {
	memos := []domain.Memo{}
	for _, id := range ids {
		if memo, ok := f.memos[id]; ok {
			memos = append(memos, memo)
		}
	}
	return memos, nil
}

func (f *fakeMemoryStore) SaveDebugLog(
	_ context.Context,
	_, _ uuid.UUID,
	log service.MemoryDebugLog,
) error {
	f.savedDebugLog = append(f.savedDebugLog, log)
	return nil
}

func (f *fakeMemoryStore) RetrievalCandidates(
	_ context.Context,
	_, _ uuid.UUID,
	_ int64,
) ([]domain.MemoryCandidate, error) {
	return f.candidates, nil
}
