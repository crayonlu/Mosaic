package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// seedMemo inserts one memo for the user and returns its identifier.
func seedMemo(t *testing.T, store *fakeMemoStore, userID uuid.UUID, content string, tags ...string) uuid.UUID {
	t.Helper()

	memo := domain.Memo{
		ID:            uuid.New(),
		UserID:        userID,
		Content:       content,
		Tags:          tags,
		CreatedAt:     time.Now().UnixMilli(),
		UpdatedAt:     time.Now().UnixMilli(),
		RevisionCount: 1,
	}
	if _, err := store.Create(context.Background(), memo, domain.MemoRevision{
		ID: uuid.New(), MemoID: memo.ID, UserID: userID, RevisionNumber: 1,
		Content: content, Tags: tags, CreatedAt: memo.CreatedAt,
	}); err != nil {
		t.Fatalf("seeding memo: %v", err)
	}
	return memo.ID
}

func searchRequest(t *testing.T, router http.Handler, token, query string) *httptest.ResponseRecorder {
	t.Helper()

	req := httptest.NewRequest(http.MethodGet, query, nil)
	req.Header.Set("Authorization", "Bearer "+token)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

// TestSearchReportsSemanticEnabledTruthfully is the core of the semantic
// contract: the flag is true exactly when a query embedding drove the ranking.
func TestSearchReportsSemanticEnabledTruthfully(t *testing.T) {
	cases := []struct {
		name          string
		embedder      *stubEmbedder
		wantSemantic  bool
		wantHybridHit bool
	}{
		{
			name:          "an embedding was produced",
			embedder:      &stubEmbedder{embedding: []float32{0.11, -0.22, 0.33}},
			wantSemantic:  true,
			wantHybridHit: true,
		},
		{
			name:         "the provider failed",
			embedder:     &stubEmbedder{err: errors.New("provider unavailable")},
			wantSemantic: false,
		},
		{
			name:         "the provider returned an empty vector",
			embedder:     &stubEmbedder{embedding: nil},
			wantSemantic: false,
		},
		{
			name:         "the provider returned all zeros",
			embedder:     &stubEmbedder{embedding: []float32{0, 0, 0}},
			wantSemantic: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			store := newFakeMemoStore()
			service := newMemoService(store, stubClips{})

			semanticID := uuid.New()
			hybridStore := &fakeHybridStore{hits: []domain.HybridHit{{
				Memo:          domain.Memo{ID: semanticID, Content: "a semantically close memo"},
				KeywordScore:  0.0,
				SemanticScore: 0.9,
			}}}
			hybrid := servicepkgNewHybrid(hybridStore)

			router, userID := newMemoRouterWith(t, service, hybrid, tc.embedder)
			seedMemo(t, store, userID, "alpha keyword memo", "alpha")

			rec := searchRequest(t, router, memoToken(t, userID), "/memos/search?query=alpha")
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200 (body %s)", rec.Code, rec.Body)
			}

			var body struct {
				Memos           []map[string]any `json:"memos"`
				Total           int64            `json:"total"`
				SemanticEnabled bool             `json:"semanticEnabled"`
			}
			decodeBody(t, rec, &body)

			if body.SemanticEnabled != tc.wantSemantic {
				t.Errorf("semanticEnabled = %v, want %v", body.SemanticEnabled, tc.wantSemantic)
			}
			if len(body.Memos) == 0 {
				t.Fatal("search returned no memos")
			}

			_, hasMatchType := body.Memos[0]["matchType"]
			if hasMatchType != tc.wantHybridHit {
				t.Errorf("matchType present = %v, want %v (memo %v)",
					hasMatchType, tc.wantHybridHit, body.Memos[0])
			}

			if len(hybridStore.seen) != boolToInt(tc.wantHybridHit) {
				t.Errorf("the hybrid store was consulted %d times, want %d",
					len(hybridStore.seen), boolToInt(tc.wantHybridHit))
			}

			if tc.embedder.calls != 1 {
				t.Errorf("the embedder was called %d times, want 1", tc.embedder.calls)
			}
			if tc.embedder.lastText != "alpha" {
				t.Errorf("the embedder saw %q, want the query text", tc.embedder.lastText)
			}
		})
	}
}

// TestSearchPassesTheEmbeddingToTheHybridStore proves the vector actually
// reaches retrieval rather than being computed and discarded.
func TestSearchPassesTheEmbeddingToTheHybridStore(t *testing.T) {
	store := newFakeMemoStore()
	svc := newMemoService(store, stubClips{})

	embedding := []float32{0.5, 0.25, -0.125}
	embedder := &stubEmbedder{embedding: embedding}
	hybridStore := &fakeHybridStore{}
	router, userID := newMemoRouterWith(t, svc, servicepkgNewHybrid(hybridStore), embedder)
	seedMemo(t, store, userID, "anything")

	rec := searchRequest(t, router, memoToken(t, userID), "/memos/search?query=vector+probe")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}

	if len(hybridStore.seen) != 1 {
		t.Fatalf("the hybrid store was consulted %d times, want 1", len(hybridStore.seen))
	}
	filter := hybridStore.seen[0]
	if filter.Query != "vector probe" {
		t.Errorf("filter query = %q, want %q", filter.Query, "vector probe")
	}
	if len(filter.Embedding) != len(embedding) {
		t.Fatalf("filter embedding length = %d, want %d", len(filter.Embedding), len(embedding))
	}
	for i := range embedding {
		if filter.Embedding[i] != embedding[i] {
			t.Fatalf("filter embedding[%d] = %v, want %v", i, filter.Embedding[i], embedding[i])
		}
	}
}

// TestSearchRanksByFusedScore proves the response is ordered by the fusion, not
// by whichever leg happened to return first.
func TestSearchRanksByFusedScore(t *testing.T) {
	store := newFakeMemoStore()
	svc := newMemoService(store, stubClips{})

	bothLegs := uuid.New()
	semanticOnly := uuid.New()
	keywordOnly := uuid.New()

	hybridStore := &fakeHybridStore{hits: []domain.HybridHit{
		{Memo: domain.Memo{ID: keywordOnly, Content: "keyword only"}, KeywordScore: 1.0, SemanticScore: 0.0},
		{Memo: domain.Memo{ID: semanticOnly, Content: "semantic only"}, KeywordScore: 0.0, SemanticScore: 1.0},
		{Memo: domain.Memo{ID: bothLegs, Content: "both legs"}, KeywordScore: 1.0, SemanticScore: 0.95},
	}}
	embedder := &stubEmbedder{embedding: []float32{1, 0, 0}}

	router, userID := newMemoRouterWith(t, svc, servicepkgNewHybrid(hybridStore), embedder)
	rec := searchRequest(t, router, memoToken(t, userID), "/memos/search?query=alpha")

	var body hybridSearchResponse
	decodeBody(t, rec, &body)

	if len(body.Memos) != 3 {
		t.Fatalf("returned %d memos, want 3", len(body.Memos))
	}
	if body.Memos[0].ID != bothLegs.String() {
		t.Errorf("first = %s, want the both-legs memo", body.Memos[0].ID)
	}
	if body.Memos[1].ID != semanticOnly.String() {
		t.Errorf("second = %s, want the semantic-only memo", body.Memos[1].ID)
	}
	if body.Memos[2].ID != keywordOnly.String() {
		t.Errorf("third = %s, want the keyword-only memo", body.Memos[2].ID)
	}
	if body.Memos[0].MatchType != domain.MatchTypeHybrid {
		t.Errorf("first matchType = %q, want hybrid", body.Memos[0].MatchType)
	}

	// The scores travel to the client, so a UI can explain the ordering.
	if body.Memos[0].KeywordScore != 1.0 || body.Memos[0].SemanticScore != 0.95 {
		t.Errorf("scores = %v / %v", body.Memos[0].KeywordScore, body.Memos[0].SemanticScore)
	}
}

// TestSearchWithAnEmptyQueryNeverEmbeds keeps the embedder off the path the
// previous server also kept it off.
func TestSearchWithAnEmptyQueryNeverEmbeds(t *testing.T) {
	store := newFakeMemoStore()
	svc := newMemoService(store, stubClips{})

	embedder := &stubEmbedder{embedding: []float32{1, 2, 3}}
	hybridStore := &fakeHybridStore{}
	router, userID := newMemoRouterWith(t, svc, servicepkgNewHybrid(hybridStore), embedder)
	seedMemo(t, store, userID, "a memo with no query")

	rec := searchRequest(t, router, memoToken(t, userID), "/memos/search?pageSize=10")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}

	var body searchMemosResponse
	decodeBody(t, rec, &body)
	if body.SemanticEnabled {
		t.Error("an empty query reported semanticEnabled true")
	}
	if embedder.calls != 0 {
		t.Errorf("the embedder was called %d times for an empty query, want 0", embedder.calls)
	}
	if len(hybridStore.seen) != 0 {
		t.Errorf("the hybrid store was consulted %d times for an empty query", len(hybridStore.seen))
	}
	if len(body.Memos) != 1 {
		t.Errorf("returned %d memos, want the seeded one", len(body.Memos))
	}
}

// TestSearchResponseShapesDifferByBranch pins that the keyword branch keeps the
// original shape and the semantic branch adds the score fields.
func TestSearchResponseShapesDifferByBranch(t *testing.T) {
	store := newFakeMemoStore()
	svc := newMemoService(store, stubClips{})
	hybridStore := &fakeHybridStore{hits: []domain.HybridHit{{
		Memo: domain.Memo{ID: uuid.New(), Content: "x"}, KeywordScore: 1, SemanticScore: 0.9,
	}}}
	router, userID := newMemoRouterWith(t, svc, servicepkgNewHybrid(hybridStore),
		&stubEmbedder{embedding: []float32{1}})
	seedMemo(t, store, userID, "x")

	rec := searchRequest(t, router, memoToken(t, userID), "/memos/search?query=x")

	var raw map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &raw); err != nil {
		t.Fatalf("decoding body: %v", err)
	}
	for _, field := range []string{"memos", "total", "page", "pageSize", "semanticEnabled"} {
		if _, ok := raw[field]; !ok {
			t.Errorf("response is missing %q: %v", field, raw)
		}
	}

	memos, ok := raw["memos"].([]any)
	if !ok || len(memos) == 0 {
		t.Fatalf("memos is not a non-empty array: %v", raw["memos"])
	}
	first := memos[0].(map[string]any)
	for _, field := range []string{"keywordScore", "semanticScore", "matchType", "resources"} {
		if _, ok := first[field]; !ok {
			t.Errorf("hybrid item is missing %q: %v", field, first)
		}
	}
}

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

// servicepkgNewHybrid keeps the service-package import local to this file.
func servicepkgNewHybrid(store *fakeHybridStore) *service.HybridSearchService {
	return service.NewHybridSearchService(store, nil)
}
