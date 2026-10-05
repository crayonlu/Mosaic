package httpapi

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/auth"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

const memoSecret = "memo-secret"

func TestCreateMemoRoundTripsIntoList(t *testing.T) {
	store := newFakeMemoStore()
	router, userID := newMemoRouter(t, newMemoService(store, stubClips{}))
	token := memoToken(t, userID)

	created := postJSON(t, router, "/memos", `{"content":"hello world","tags":["work","api"]}`, token)
	if created.Code != http.StatusOK {
		t.Fatalf("create status = %d, want 200 (body %s)", created.Code, created.Body)
	}
	var memo memoResponse
	decodeBody(t, created, &memo)
	if memo.ID == "" {
		t.Fatal("created memo has no id")
	}
	if memo.Content != "hello world" {
		t.Errorf("content = %q, want %q", memo.Content, "hello world")
	}
	if memo.RevisionCount != 1 {
		t.Errorf("revision count = %d, want 1", memo.RevisionCount)
	}
	if len(memo.Tags) != 2 {
		t.Errorf("tags = %v, want two entries", memo.Tags)
	}

	list := getWithToken(t, router, "/memos", token)
	if list.Code != http.StatusOK {
		t.Fatalf("list status = %d, want 200", list.Code)
	}
	var page paginatedMemoResponse
	decodeBody(t, list, &page)
	if page.Total != 1 || len(page.Items) != 1 {
		t.Fatalf("list total = %d, items = %d, want 1/1", page.Total, len(page.Items))
	}
	if page.Items[0].ID != memo.ID {
		t.Errorf("listed id = %q, want %q", page.Items[0].ID, memo.ID)
	}
	if page.Page != 1 || page.PageSize != 20 || page.TotalPages != 1 {
		t.Errorf("envelope = %+v, want page 1 size 20 pages 1", page)
	}
}

func TestListPaginationEnvelope(t *testing.T) {
	store := newFakeMemoStore()
	router, userID := newMemoRouter(t, newMemoService(store, stubClips{}))
	token := memoToken(t, userID)

	for i := 0; i < 3; i++ {
		created := postJSON(t, router, "/memos", `{"content":"memo"}`, token)
		if created.Code != http.StatusOK {
			t.Fatalf("create %d status = %d", i, created.Code)
		}
	}

	first := getWithToken(t, router, "/memos?page=1&pageSize=2", token)
	var page paginatedMemoResponse
	decodeBody(t, first, &page)
	if len(page.Items) != 2 || page.Total != 3 || page.TotalPages != 2 || page.PageSize != 2 {
		t.Errorf("first page = %+v, want 2 items of 3 across 2 pages", page)
	}

	second := getWithToken(t, router, "/memos?page=2&pageSize=2", token)
	var tail paginatedMemoResponse
	decodeBody(t, second, &tail)
	if len(tail.Items) != 1 {
		t.Errorf("second page items = %d, want 1", len(tail.Items))
	}
}

func TestUpdateMemoIsVisibleOnReReadAndAddsRevision(t *testing.T) {
	store := newFakeMemoStore()
	router, userID := newMemoRouter(t, newMemoService(store, stubClips{}))
	token := memoToken(t, userID)

	created := postJSON(t, router, "/memos", `{"content":"original"}`, token)
	var memo memoResponse
	decodeBody(t, created, &memo)

	updated := putJSON(t, router, "/memos/"+memo.ID, `{"content":"revised"}`, token)
	if updated.Code != http.StatusOK {
		t.Fatalf("update status = %d, want 200 (body %s)", updated.Code, updated.Body)
	}
	var updatedMemo memoResponse
	decodeBody(t, updated, &updatedMemo)
	if updatedMemo.Content != "revised" {
		t.Errorf("updated content = %q, want %q", updatedMemo.Content, "revised")
	}
	if updatedMemo.RevisionCount != 2 {
		t.Errorf("revision count = %d, want 2", updatedMemo.RevisionCount)
	}

	reread := getWithToken(t, router, "/memos/"+memo.ID, token)
	var fetched memoResponse
	decodeBody(t, reread, &fetched)
	if fetched.Content != "revised" {
		t.Errorf("re-read content = %q, want %q", fetched.Content, "revised")
	}

	revisions := getWithToken(t, router, "/memos/"+memo.ID+"/revisions", token)
	var history []memoRevisionResponse
	decodeBody(t, revisions, &history)
	if len(history) != 2 {
		t.Fatalf("revision count = %d, want 2", len(history))
	}
	if history[1].Content != "revised" || history[1].RevisionNumber != 2 {
		t.Errorf("latest revision = %+v, want number 2 with revised content", history[1])
	}
}

func TestDeleteRevisionGuardsTheLastOne(t *testing.T) {
	store := newFakeMemoStore()
	router, userID := newMemoRouter(t, newMemoService(store, stubClips{}))
	token := memoToken(t, userID)

	created := postJSON(t, router, "/memos", `{"content":"v1"}`, token)
	var memo memoResponse
	decodeBody(t, created, &memo)
	putJSON(t, router, "/memos/"+memo.ID, `{"content":"v2"}`, token)

	revisions := getWithToken(t, router, "/memos/"+memo.ID+"/revisions", token)
	var history []memoRevisionResponse
	decodeBody(t, revisions, &history)

	deleted := doJSON(t, router, http.MethodDelete,
		"/memos/"+memo.ID+"/revisions/"+history[0].ID, "", token)
	if deleted.Code != http.StatusOK {
		t.Fatalf("delete revision = %d, want 200 (body %s)", deleted.Code, deleted.Body)
	}

	after := getWithToken(t, router, "/memos/"+memo.ID+"/revisions", token)
	var remaining []memoRevisionResponse
	decodeBody(t, after, &remaining)
	if len(remaining) != 1 {
		t.Fatalf("remaining revisions = %d, want 1", len(remaining))
	}

	last := doJSON(t, router, http.MethodDelete,
		"/memos/"+memo.ID+"/revisions/"+remaining[0].ID, "", token)
	if last.Code != http.StatusBadRequest {
		t.Errorf("deleting the last revision = %d, want 400 (body %s)", last.Code, last.Body)
	}
}

func TestTagCounts(t *testing.T) {
	store := newFakeMemoStore()
	router, userID := newMemoRouter(t, newMemoService(store, stubClips{}))
	token := memoToken(t, userID)

	postJSON(t, router, "/memos", `{"content":"one","tags":["work","api"]}`, token)
	postJSON(t, router, "/memos", `{"content":"two","tags":["work"]}`, token)

	rec := getWithToken(t, router, "/memos/tags", token)
	var tags []domain.TagCount
	decodeBody(t, rec, &tags)

	got := map[string]int64{}
	for _, tag := range tags {
		got[tag.Tag] = tag.Count
	}
	if got["work"] != 2 || got["api"] != 1 {
		t.Errorf("tag counts = %v, want work=2 api=1", got)
	}
	if len(tags) != 2 || tags[0].Tag != "api" {
		t.Errorf("tags should be sorted by name: %+v", tags)
	}
}

func TestArchiveFlipsIsArchived(t *testing.T) {
	store := newFakeMemoStore()
	router, userID := newMemoRouter(t, newMemoService(store, stubClips{}))
	token := memoToken(t, userID)

	created := postJSON(t, router, "/memos", `{"content":"archive me"}`, token)
	var memo memoResponse
	decodeBody(t, created, &memo)

	archived := putJSON(t, router, "/memos/"+memo.ID+"/archive", `{}`, token)
	if archived.Code != http.StatusOK {
		t.Fatalf("archive = %d, want 200 (body %s)", archived.Code, archived.Body)
	}

	fetched := getWithToken(t, router, "/memos/"+memo.ID, token)
	var archivedMemo memoResponse
	decodeBody(t, fetched, &archivedMemo)
	if !archivedMemo.IsArchived {
		t.Error("isArchived should be true after archive")
	}

	unarchived := putJSON(t, router, "/memos/"+memo.ID+"/unarchive", "", token)
	if unarchived.Code != http.StatusOK {
		t.Fatalf("unarchive = %d, want 200 (body %s)", unarchived.Code, unarchived.Body)
	}
	fetched = getWithToken(t, router, "/memos/"+memo.ID, token)
	var live memoResponse
	decodeBody(t, fetched, &live)
	if live.IsArchived {
		t.Error("isArchived should be false after unarchive")
	}
}

func TestMemosByCreatedDate(t *testing.T) {
	fixedNow := time.Date(2026, time.February, 24, 12, 0, 0, 0, time.UTC).UnixMilli()
	store := newFakeMemoStore()
	svc := newMemoService(store, stubClips{}).WithClock(func() int64 { return fixedNow })
	router, userID := newMemoRouter(t, svc)
	token := memoToken(t, userID)

	postJSON(t, router, "/memos", `{"content":"on the day"}`, token)

	rec := getWithToken(t, router, "/memos/date/2026-02-24", token)
	if rec.Code != http.StatusOK {
		t.Fatalf("by-date status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}
	var memos []memoResponse
	decodeBody(t, rec, &memos)
	if len(memos) != 1 || memos[0].Content != "on the day" {
		t.Errorf("by-date memos = %+v, want the created memo", memos)
	}
}

func TestMemoDetailIncludesBotReplies(t *testing.T) {
	store := newFakeMemoStore()
	router, userID := newMemoRouter(t, newMemoService(store, stubClips{}))
	token := memoToken(t, userID)

	created := postJSON(t, router, "/memos", `{"content":"with reply"}`, token)
	var memo memoResponse
	decodeBody(t, created, &memo)

	memoID, err := uuid.Parse(memo.ID)
	if err != nil {
		t.Fatalf("parsing memo id: %v", err)
	}
	store.replies[memoID] = []domain.BotReply{{
		ID:        uuid.New(),
		MemoID:    memoID,
		BotID:     uuid.New(),
		Content:   "a bot reply",
		CreatedAt: time.Now().UnixMilli(),
	}}

	rec := getWithToken(t, router, "/memos/"+memo.ID+"/detail", token)
	if rec.Code != http.StatusOK {
		t.Fatalf("detail status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}
	var detail memoDetailResponse
	decodeBody(t, rec, &detail)
	if detail.Memo.ID != memo.ID {
		t.Errorf("detail memo id = %q, want %q", detail.Memo.ID, memo.ID)
	}
	if len(detail.Revisions) != 1 {
		t.Errorf("detail revisions = %d, want 1", len(detail.Revisions))
	}
	if len(detail.BotReplies) != 1 || detail.BotReplies[0].Content != "a bot reply" {
		t.Errorf("detail bot replies = %+v, want one reply", detail.BotReplies)
	}
}

func TestOwnershipIsEnforced(t *testing.T) {
	store := newFakeMemoStore()
	router, userID := newMemoRouter(t, newMemoService(store, stubClips{}))
	token := memoToken(t, userID)

	created := postJSON(t, router, "/memos", `{"content":"private"}`, token)
	var memo memoResponse
	decodeBody(t, created, &memo)

	otherToken := memoToken(t, uuid.New())
	rec := getWithToken(t, router, "/memos/"+memo.ID, otherToken)
	if rec.Code != http.StatusNotFound {
		t.Errorf("cross-user read = %d, want 404", rec.Code)
	}
}

func TestSearchMemoResponseShape(t *testing.T) {
	store := newFakeMemoStore()
	router, userID := newMemoRouter(t, newMemoService(store, stubClips{}))
	token := memoToken(t, userID)

	postJSON(t, router, "/memos", `{"content":"semantic search target","tags":["work"]}`, token)

	rec := getWithToken(t, router, "/memos/search?query=target&page_size=1", token)
	if rec.Code != http.StatusOK {
		t.Fatalf("search status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}
	var body searchMemosResponse
	decodeBody(t, rec, &body)
	if len(body.Memos) != 1 || body.Memos[0].Content != "semantic search target" {
		t.Errorf("search memos = %+v, want the matching memo", body.Memos)
	}
	if body.Total != 1 || body.Page != 1 || body.PageSize != 1 {
		t.Errorf("search envelope = %+v, want total 1 page 1 size 1", body)
	}
	if body.SemanticEnabled {
		t.Error("semanticEnabled should be false without an embedding provider")
	}

	byBracket := getWithToken(t, router, "/memos/search?tags[]=work", token)
	var bracket searchMemosResponse
	decodeBody(t, byBracket, &bracket)
	if len(bracket.Memos) != 1 {
		t.Errorf("tags[] filter returned %d memos, want 1", len(bracket.Memos))
	}

	byPlain := getWithToken(t, router, "/memos/search?tags=work", token)
	var plain searchMemosResponse
	decodeBody(t, byPlain, &plain)
	if len(plain.Memos) != 1 {
		t.Errorf("tags filter returned %d memos, want 1", len(plain.Memos))
	}
}

func newMemoRouter(t *testing.T, svc *service.MemoService) (http.Handler, uuid.UUID) {
	t.Helper()
	return newMemoRouterWith(t, svc, defaultHybridService(), &stubEmbedder{})
}

// newMemoRouterWith lets a search test supply its own hybrid service and
// embedder while every other memo test keeps the defaults.
func newMemoRouterWith(
	t *testing.T,
	svc *service.MemoService,
	hybrid *service.HybridSearchService,
	embedder QueryEmbedder,
) (http.Handler, uuid.UUID) {
	t.Helper()
	userID := uuid.New()
	router := chi.NewRouter()
	router.Group(func(r chi.Router) {
		r.Use(RequireAuth(memoSecret))
		registerMemoRoutes(r, svc, hybrid, embedder)
	})
	return router, userID
}

func memoToken(t *testing.T, userID uuid.UUID) string {
	t.Helper()
	token, err := auth.Sign(memoSecret, userID.String(), domain.RoleUser, false, time.Hour)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	return token
}

func newMemoService(store *fakeMemoStore, clips stubClips) *service.MemoService {
	return service.NewMemoService(store, store, clips, time.UTC, service.NoPipeline{},
		fakeChatConfigs{}, fakeCompletion{}, fakeBotImages{})
}

type stubClips struct{}

func (stubClips) Fetch(context.Context, string) (service.ClipArticle, error) {
	return service.ClipArticle{}, domain.Internal(errors.New("clip not configured"))
}
