package httpapi

import (
	"context"
	"net/http"
	"sort"
	"sync"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/admin"
	"github.com/crayonlu/mosaic/server-go/internal/auth"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

func TestBotCRUDRoundTrip(t *testing.T) {
	userID := uuid.New()
	store := newFakeBotStore()
	memos := newFakeBotMemoStore()
	svc := newBotTestService(store, memos)
	router := newBotTestRouter(svc)
	token := botToken(t, userID)

	first := postJSON(t, router, "/bots",
		`{"name":"Companion","description":"calm","tags":["a","b"],"autoReply":false}`, token)
	if first.Code != http.StatusCreated {
		t.Fatalf("create status = %d, want 201 (body %s)", first.Code, first.Body)
	}
	var created botResponse
	decodeBody(t, first, &created)
	if created.Name != "Companion" || created.Description != "calm" {
		t.Errorf("created = %+v", created)
	}
	if len(created.Tags) != 2 || created.Tags[0] != "a" || created.Tags[1] != "b" {
		t.Errorf("created tags = %v", created.Tags)
	}
	if created.AutoReply {
		t.Error("autoReply = true, want the supplied false")
	}
	if created.SortOrder != 0 {
		t.Errorf("first sortOrder = %d, want 0", created.SortOrder)
	}
	if created.MemoryStats != nil {
		t.Errorf("create response memoryStats = %+v, want nil", created.MemoryStats)
	}

	second := postJSON(t, router, "/bots", `{"name":"Second"}`, token)
	var createdSecond botResponse
	decodeBody(t, second, &createdSecond)
	if createdSecond.SortOrder != 1 {
		t.Errorf("second sortOrder = %d, want 1", createdSecond.SortOrder)
	}
	if !createdSecond.AutoReply {
		t.Error("autoReply did not default to true")
	}

	list := getWithToken(t, router, "/bots", token)
	if list.Code != http.StatusOK {
		t.Fatalf("list status = %d (body %s)", list.Code, list.Body)
	}
	var listed []botResponse
	decodeBody(t, list, &listed)
	if len(listed) != 2 {
		t.Fatalf("listed %d bots, want 2", len(listed))
	}
	if listed[0].ID != created.ID || listed[1].ID != createdSecond.ID {
		t.Errorf("list order = %s, %s", listed[0].ID, listed[1].ID)
	}
	// Memory stats are reported by the list endpoint.
	createdID, _ := uuid.Parse(created.ID)
	store.setStats(createdID, domain.BotMemoryStats{TotalContextsBuilt: 4})
	list = getWithToken(t, router, "/bots", token)
	decodeBody(t, list, &listed)
	if listed[0].MemoryStats == nil || listed[0].MemoryStats.TotalContextsBuilt != 4 {
		t.Errorf("list memoryStats = %+v", listed[0].MemoryStats)
	}

	updated := putJSON(t, router, "/bots/"+created.ID,
		`{"name":"Renamed","tags":["x"],"autoReply":true,"sortOrder":5}`, token)
	if updated.Code != http.StatusOK {
		t.Fatalf("update status = %d, want 200 (body %s)", updated.Code, updated.Body)
	}
	var updatedBot botResponse
	decodeBody(t, updated, &updatedBot)
	if updatedBot.Name != "Renamed" || updatedBot.SortOrder != 5 || !updatedBot.AutoReply {
		t.Errorf("updated = %+v", updatedBot)
	}
	if len(updatedBot.Tags) != 1 || updatedBot.Tags[0] != "x" {
		t.Errorf("updated tags = %v", updatedBot.Tags)
	}

	reordered := putJSON(t, router, "/bots/reorder",
		`{"order":["`+createdSecond.ID+`","`+created.ID+`"]}`, token)
	if reordered.Code != http.StatusOK {
		t.Fatalf("reorder status = %d (body %s)", reordered.Code, reordered.Body)
	}

	list = getWithToken(t, router, "/bots", token)
	decodeBody(t, list, &listed)
	if listed[0].ID != createdSecond.ID || listed[0].SortOrder != 0 {
		t.Errorf("after reorder first = %+v", listed[0])
	}
	if listed[1].ID != created.ID || listed[1].SortOrder != 1 {
		t.Errorf("after reorder second = %+v", listed[1])
	}

	deleted := doJSON(t, router, http.MethodDelete, "/bots/"+created.ID, "", token)
	if deleted.Code != http.StatusNoContent {
		t.Fatalf("delete status = %d, want 204 (body %s)", deleted.Code, deleted.Body)
	}

	list = getWithToken(t, router, "/bots", token)
	decodeBody(t, list, &listed)
	if len(listed) != 1 || listed[0].ID != createdSecond.ID {
		t.Errorf("after delete list = %+v", listed)
	}
}

func TestBotUpdateClearsNullableFields(t *testing.T) {
	userID := uuid.New()
	store := newFakeBotStore()
	svc := newBotTestService(store, newFakeBotMemoStore())
	router := newBotTestRouter(svc)
	token := botToken(t, userID)

	avatar := "/api/avatars/x/download"
	model := "gpt-x"
	id := store.seed(domain.Bot{
		UserID: userID, Name: "Bot", AvatarURL: &avatar, Model: &model,
		Tags: []string{}, AutoReply: true, CreatedAt: 1, UpdatedAt: 1,
	})

	rec := putJSON(t, router, "/bots/"+id.String(), `{"avatarUrl":null,"model":null}`, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (body %s)", rec.Code, rec.Body)
	}
	var updated botResponse
	decodeBody(t, rec, &updated)
	if updated.AvatarURL != nil {
		t.Errorf("avatarUrl = %v, want nil", updated.AvatarURL)
	}
	if updated.Model != nil {
		t.Errorf("model = %v, want nil", updated.Model)
	}
}

func TestBotReplyThreading(t *testing.T) {
	userID := uuid.New()
	memoID := uuid.New()
	store := newFakeBotStore()
	svc := newBotTestService(store, newFakeBotMemoStore())
	router := newBotTestRouter(svc)
	token := botToken(t, userID)

	botID := store.seed(domain.Bot{
		UserID: userID, Name: "Muse", Tags: []string{}, AutoReply: true,
		CreatedAt: 1, UpdatedAt: 1,
	})

	rootID := store.seedReply(domain.BotReply{
		MemoID: memoID, BotID: botID, Content: "root",
		RevisionNumber: int32Pointer(1), CreatedAt: 100,
	})
	childID := store.seedReply(domain.BotReply{
		MemoID: memoID, BotID: botID, Content: "child",
		ParentReplyID: &rootID, UserQuestion: stringPointer("why?"),
		RevisionNumber: int32Pointer(1), CreatedAt: 200,
	})
	grandchildID := store.seedReply(domain.BotReply{
		MemoID: memoID, BotID: botID, Content: "grandchild",
		ParentReplyID: &childID, UserQuestion: stringPointer("more"),
		RevisionNumber: int32Pointer(1), CreatedAt: 300,
	})
	// A second automatic root for the same revision must be hidden.
	store.seedReply(domain.BotReply{
		MemoID: memoID, BotID: botID, Content: "duplicate",
		RevisionNumber: int32Pointer(1), CreatedAt: 400,
	})

	rec := getWithToken(t, router, "/memos/"+memoID.String()+"/bot-replies", token)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (body %s)", rec.Code, rec.Body)
	}
	var replies []botReplyNodeResponse
	decodeBody(t, rec, &replies)
	if len(replies) != 1 {
		t.Fatalf("returned %d roots, want 1", len(replies))
	}
	root := replies[0]
	if root.ID != rootID.String() {
		t.Errorf("root id = %s, want %s", root.ID, rootID)
	}
	if root.Bot.Name != "Muse" {
		t.Errorf("bot summary = %+v", root.Bot)
	}
	if root.ThreadCount != 3 {
		t.Errorf("threadCount = %d, want 3", root.ThreadCount)
	}
	if root.LatestReplyID != grandchildID.String() {
		t.Errorf("latestReplyId = %s, want %s", root.LatestReplyID, grandchildID)
	}
	if len(root.Children) != 1 || root.Children[0].ID != childID.String() {
		t.Fatalf("children = %+v", root.Children)
	}
	child := root.Children[0]
	if child.UserQuestion == nil || *child.UserQuestion != "why?" {
		t.Errorf("child userQuestion = %v", child.UserQuestion)
	}
	if len(child.Children) != 1 || child.Children[0].ID != grandchildID.String() {
		t.Fatalf("grandchild not nested: %+v", child.Children)
	}

	thread := getWithToken(t, router, "/bot-replies/"+rootID.String()+"/thread", token)
	if thread.Code != http.StatusOK {
		t.Fatalf("thread status = %d (body %s)", thread.Code, thread.Body)
	}
	var conversation botThreadResponse
	decodeBody(t, thread, &conversation)
	if conversation.MemoID != memoID.String() || conversation.Bot.Name != "Muse" {
		t.Errorf("thread header = %+v", conversation)
	}
	if len(conversation.Messages) != 5 {
		t.Fatalf("thread messages = %d, want 5", len(conversation.Messages))
	}
	if conversation.Messages[0].Role != "assistant" ||
		conversation.Messages[1].Role != "user" {
		t.Errorf("message roles = %s, %s", conversation.Messages[0].Role, conversation.Messages[1].Role)
	}
	if conversation.LatestReplyID != grandchildID.String() {
		t.Errorf("thread latest = %s", conversation.LatestReplyID)
	}
}

func TestBotNotFound(t *testing.T) {
	userID := uuid.New()
	svc := newBotTestService(newFakeBotStore(), newFakeBotMemoStore())
	router := newBotTestRouter(svc)
	token := botToken(t, userID)

	rec := getWithToken(t, router, "/bots/"+uuid.New().String(), token)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404 (body %s)", rec.Code, rec.Body)
	}
	var body errorBody
	decodeBody(t, rec, &body)
	if body.Message != "Bot not found" {
		t.Errorf("message = %q", body.Message)
	}
}

func int32Pointer(value int32) *int32 { return &value }

func stringPointer(value string) *string { return &value }

func newBotTestService(store *fakeBotStore, memos *fakeBotMemoStore) *service.BotService {
	return service.NewBotService(
		store, memos, fakeMemoryBuilder{}, fakeChatConfigs{}, fakeCompletion{},
		fakeBotImages{}, fakeTimezone{}, admin.NewActivityLog(10), newFakeGenerationLocks())
}

func newBotTestRouter(svc *service.BotService) http.Handler {
	router := chi.NewRouter()
	router.Group(func(r chi.Router) {
		r.Use(RequireAuth(routerSecret))
		registerBotRoutes(r, svc)
	})
	return router
}

func botToken(t *testing.T, userID uuid.UUID) string {
	t.Helper()
	token, err := auth.Sign(routerSecret, userID.String(), domain.RoleUser, false, time.Hour)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	return token
}

type fakeBotStore struct {
	mu        sync.Mutex
	bots      map[uuid.UUID]domain.Bot
	order     []uuid.UUID
	replies   map[uuid.UUID]domain.BotReply
	resources map[uuid.UUID][]uuid.UUID
	stats     map[uuid.UUID]domain.BotMemoryStats
}

func newFakeBotStore() *fakeBotStore {
	return &fakeBotStore{
		bots:      make(map[uuid.UUID]domain.Bot),
		replies:   make(map[uuid.UUID]domain.BotReply),
		resources: make(map[uuid.UUID][]uuid.UUID),
		stats:     make(map[uuid.UUID]domain.BotMemoryStats),
	}
}

func (f *fakeBotStore) seed(bot domain.Bot) uuid.UUID {
	f.mu.Lock()
	defer f.mu.Unlock()
	if bot.ID == uuid.Nil {
		bot.ID = uuid.New()
	}
	f.bots[bot.ID] = bot
	f.order = append(f.order, bot.ID)
	return bot.ID
}

func (f *fakeBotStore) seedReply(reply domain.BotReply) uuid.UUID {
	f.mu.Lock()
	defer f.mu.Unlock()
	if reply.ID == uuid.Nil {
		reply.ID = uuid.New()
	}
	f.replies[reply.ID] = reply
	return reply.ID
}

func (f *fakeBotStore) setStats(botID uuid.UUID, stats domain.BotMemoryStats) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.stats[botID] = stats
}

func (f *fakeBotStore) List(_ context.Context, userID uuid.UUID) ([]domain.Bot, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	bots := []domain.Bot{}
	for _, id := range f.order {
		bot := f.bots[id]
		if bot.UserID == userID && !bot.IsDeleted {
			bots = append(bots, bot)
		}
	}
	sort.SliceStable(bots, func(i, j int) bool {
		if bots[i].SortOrder != bots[j].SortOrder {
			return bots[i].SortOrder < bots[j].SortOrder
		}
		return bots[i].CreatedAt < bots[j].CreatedAt
	})
	return bots, nil
}

func (f *fakeBotStore) Get(_ context.Context, userID, botID uuid.UUID) (domain.Bot, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	bot, ok := f.bots[botID]
	if !ok || bot.UserID != userID || bot.IsDeleted {
		return domain.Bot{}, domain.ErrNoRows
	}
	return bot, nil
}

func (f *fakeBotStore) ByID(_ context.Context, userID, botID uuid.UUID) (domain.Bot, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	bot, ok := f.bots[botID]
	if !ok || bot.UserID != userID {
		return domain.Bot{}, domain.ErrNoRows
	}
	return bot, nil
}

func (f *fakeBotStore) Create(_ context.Context, bot domain.Bot) (domain.Bot, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.bots[bot.ID] = bot
	f.order = append(f.order, bot.ID)
	return bot, nil
}

func (f *fakeBotStore) Update(_ context.Context, bot domain.Bot) (domain.Bot, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, ok := f.bots[bot.ID]; !ok {
		return domain.Bot{}, domain.ErrNoRows
	}
	f.bots[bot.ID] = bot
	return bot, nil
}

func (f *fakeBotStore) SoftDelete(_ context.Context, userID, botID uuid.UUID, _ int64) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	bot, ok := f.bots[botID]
	if !ok || bot.UserID != userID {
		return domain.ErrNoRows
	}
	bot.IsDeleted = true
	f.bots[botID] = bot
	return nil
}

func (f *fakeBotStore) MaxSortOrder(_ context.Context, userID uuid.UUID) (*int32, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var max *int32
	for _, bot := range f.bots {
		if bot.UserID != userID {
			continue
		}
		if max == nil || bot.SortOrder > *max {
			value := bot.SortOrder
			max = &value
		}
	}
	return max, nil
}

func (f *fakeBotStore) Reorder(_ context.Context, userID uuid.UUID, order []uuid.UUID, now int64) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	for index, id := range order {
		bot, ok := f.bots[id]
		if !ok || bot.UserID != userID {
			continue
		}
		bot.SortOrder = int32(index)
		bot.UpdatedAt = now
		f.bots[id] = bot
	}
	return nil
}

func (f *fakeBotStore) MemoryStats(
	_ context.Context,
	userID uuid.UUID,
) (map[uuid.UUID]domain.BotMemoryStats, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	stats := make(map[uuid.UUID]domain.BotMemoryStats)
	for id, value := range f.stats {
		if bot, ok := f.bots[id]; ok && bot.UserID == userID {
			stats[id] = value
		}
	}
	return stats, nil
}

func (f *fakeBotStore) AutoReplyBots(_ context.Context, userID uuid.UUID) ([]domain.Bot, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	bots := []domain.Bot{}
	for _, bot := range f.bots {
		if bot.UserID == userID && bot.AutoReply && !bot.IsDeleted {
			bots = append(bots, bot)
		}
	}
	return bots, nil
}

func (f *fakeBotStore) RepliesForMemo(
	_ context.Context,
	_, memoID uuid.UUID,
) ([]domain.BotReply, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	replies := []domain.BotReply{}
	for _, reply := range f.replies {
		if reply.MemoID == memoID {
			replies = append(replies, reply)
		}
	}
	sort.SliceStable(replies, func(i, j int) bool {
		return replies[i].CreatedAt < replies[j].CreatedAt
	})
	return replies, nil
}

func (f *fakeBotStore) BotSummariesByID(
	_ context.Context,
	userID uuid.UUID,
	ids []uuid.UUID,
) ([]domain.BotSummary, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	summaries := []domain.BotSummary{}
	for _, id := range ids {
		if bot, ok := f.bots[id]; ok && bot.UserID == userID {
			summaries = append(summaries, domain.BotSummary{
				ID: bot.ID, Name: bot.Name, AvatarURL: bot.AvatarURL,
			})
		}
	}
	return summaries, nil
}

func (f *fakeBotStore) ReplyByID(
	_ context.Context,
	_, replyID uuid.UUID,
) (domain.BotReply, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	reply, ok := f.replies[replyID]
	if !ok {
		return domain.BotReply{}, domain.ErrNoRows
	}
	return reply, nil
}

func (f *fakeBotStore) ThreadReplies(
	_ context.Context,
	memoID, botID, seedReplyID uuid.UUID,
) ([]domain.BotReply, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	byID := make(map[uuid.UUID]domain.BotReply, len(f.replies))
	for id, reply := range f.replies {
		byID[id] = reply
	}
	visited := make(map[uuid.UUID]bool)
	queue := []uuid.UUID{seedReplyID}
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		if visited[current] {
			continue
		}
		reply, ok := byID[current]
		if !ok || reply.MemoID != memoID || reply.BotID != botID {
			continue
		}
		visited[current] = true
		if reply.ParentReplyID != nil {
			queue = append(queue, *reply.ParentReplyID)
		}
		for _, other := range byID {
			if other.ParentReplyID != nil && *other.ParentReplyID == current {
				queue = append(queue, other.ID)
			}
		}
	}
	thread := []domain.BotReply{}
	for id := range visited {
		thread = append(thread, byID[id])
	}
	sort.SliceStable(thread, func(i, j int) bool {
		return thread[i].CreatedAt < thread[j].CreatedAt
	})
	return thread, nil
}

func (f *fakeBotStore) ResourceIDsForReplies(
	_ context.Context,
	replyIDs []uuid.UUID,
) (map[uuid.UUID][]uuid.UUID, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	resources := make(map[uuid.UUID][]uuid.UUID)
	for _, id := range replyIDs {
		if value, ok := f.resources[id]; ok {
			resources[id] = value
		}
	}
	return resources, nil
}

func (f *fakeBotStore) InsertReply(_ context.Context, reply domain.BotReply) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.replies[reply.ID] = reply
	return nil
}

func (f *fakeBotStore) InsertAutoReply(
	_ context.Context,
	reply domain.BotReply,
	_ int32,
) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, existing := range f.replies {
		if existing.MemoID == reply.MemoID && existing.BotID == reply.BotID &&
			existing.ParentReplyID == nil && existing.UserQuestion == nil {
			return false, nil
		}
	}
	f.replies[reply.ID] = reply
	return true, nil
}

func (f *fakeBotStore) InsertReplyResources(
	_ context.Context,
	replyID uuid.UUID,
	resourceIDs []uuid.UUID,
	_ int64,
) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.resources[replyID] = append(f.resources[replyID], resourceIDs...)
	return nil
}

type fakeBotMemoStore struct {
	memos     map[uuid.UUID]domain.Memo
	revisions map[uuid.UUID][]domain.MemoRevision
}

func newFakeBotMemoStore() *fakeBotMemoStore {
	return &fakeBotMemoStore{
		memos:     make(map[uuid.UUID]domain.Memo),
		revisions: make(map[uuid.UUID][]domain.MemoRevision),
	}
}

func (f *fakeBotMemoStore) MemoForBot(
	_ context.Context,
	userID, memoID uuid.UUID,
) (domain.Memo, error) {
	memo, ok := f.memos[memoID]
	if !ok || memo.UserID != userID {
		return domain.Memo{}, domain.ErrNoRows
	}
	return memo, nil
}

func (f *fakeBotMemoStore) RevisionsForContext(
	_ context.Context,
	memoID uuid.UUID,
	_ int32,
) ([]domain.MemoRevision, error) {
	return f.revisions[memoID], nil
}

type fakeMemoryBuilder struct {
	context domain.BotMemoryContext
}

func (f fakeMemoryBuilder) BuildForMemo(
	_ context.Context,
	_ domain.Memo,
) (domain.BotMemoryContext, error) {
	return f.context, nil
}

func (f fakeMemoryBuilder) PersistForBot(
	_ context.Context,
	_, _, _ uuid.UUID,
	_ domain.BotMemoryContext,
) error {
	return nil
}

type fakeChatConfigs struct{}

func (fakeChatConfigs) ChatConfig(
	_ context.Context,
	_ uuid.UUID,
) (domain.AIConfig, error) {
	return domain.AIConfig{
		Provider: "fake", BaseURL: "http://fake", APIKey: "key", Model: "model",
	}, nil
}

type fakeCompletion struct{}

func (fakeCompletion) Complete(
	_ context.Context,
	_ service.CompletionRequest,
) (service.CompletionResult, error) {
	return service.CompletionResult{Content: "generated"}, nil
}

type fakeBotImages struct{}

func (fakeBotImages) MemoImages(
	_ context.Context,
	_, _ uuid.UUID,
	_ int,
) ([]service.ImageInput, error) {
	return nil, nil
}

func (fakeBotImages) OwnedImages(
	_ context.Context,
	_ uuid.UUID,
	_ []uuid.UUID,
	_ int,
) ([]service.ImageInput, error) {
	return nil, nil
}

type fakeTimezone struct{}

func (fakeTimezone) Timezone(_ context.Context) *time.Location { return time.UTC }

// fakeGenerationLocks stands in for the database advisory lock that serialises
// bot generation across processes.
type fakeGenerationLocks struct {
	mu   sync.Mutex
	held map[string]bool
}

func newFakeGenerationLocks() *fakeGenerationLocks {
	return &fakeGenerationLocks{held: map[string]bool{}}
}

func (f *fakeGenerationLocks) TryAcquire(
	_ context.Context,
	key string,
) (func(), bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if f.held[key] {
		return nil, false, nil
	}
	f.held[key] = true

	return func() {
		f.mu.Lock()
		defer f.mu.Unlock()
		delete(f.held, key)
	}, true, nil
}
