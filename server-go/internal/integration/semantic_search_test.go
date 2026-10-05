package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

// seededMemo is a memo written straight into the database so the generation
// pipeline never touches it: these tests need full control of the vectors.
type seededMemo struct {
	id      uuid.UUID
	content string
}

// seedMemoRow inserts a memo with a fixed created_at, so recency cannot affect
// the ordering under test.
func (h *harness) seedMemoRow(t *testing.T, content string, tags ...string) seededMemo {
	t.Helper()

	id := uuid.New()
	now := time.Now().UnixMilli()
	encoded, err := json.Marshal(tags)
	if err != nil {
		t.Fatalf("encoding tags: %v", err)
	}

	if _, err := h.pool.Exec(context.Background(),
		`INSERT INTO memos (id, user_id, content, tags, is_archived, is_deleted, created_at, updated_at, revision_count)
		 VALUES ($1, $2, $3, $4::jsonb, false, false, $5, $5, 1)`,
		id, h.userID, content, string(encoded), now); err != nil {
		t.Fatalf("seeding a memo: %v", err)
	}
	return seededMemo{id: id, content: content}
}

// seedEmbedding writes a vector directly, which is how these tests make the
// cosine ordering deterministic without a provider.
func (h *harness) seedEmbedding(t *testing.T, memo seededMemo, vector []float32) {
	t.Helper()

	if _, err := h.pool.Exec(context.Background(),
		`INSERT INTO memo_embeddings (memo_id, source_text, provider, model, embedding, updated_at)
		 VALUES ($1, $2, 'seed', 'seed', $3::vector, $4)
		 ON CONFLICT (memo_id) DO UPDATE SET embedding = $3::vector`,
		memo.id, memo.content, vectorLiteral(vector), time.Now().UnixMilli()); err != nil {
		t.Fatalf("seeding an embedding: %v", err)
	}
}

func vectorLiteral(vector []float32) string {
	parts := make([]string, 0, len(vector))
	for _, value := range vector {
		parts = append(parts, fmt.Sprintf("%g", value))
	}
	return "[" + strings.Join(parts, ",") + "]"
}

// searchResponse is the shape the search endpoint returns.
type searchResponse struct {
	Memos []struct {
		ID            string  `json:"id"`
		Content       string  `json:"content"`
		KeywordScore  float64 `json:"keywordScore"`
		SemanticScore float64 `json:"semanticScore"`
		MatchType     string  `json:"matchType"`
	} `json:"memos"`
	Total           int64 `json:"total"`
	SemanticEnabled bool  `json:"semanticEnabled"`
}

// TestSearchRanksByCosineSimilarityOverRealVectors seeds vectors directly and
// asserts the shipped search ranks by the fusion of keyword match and cosine
// similarity, reporting semanticEnabled truthfully.
func TestSearchRanksByCosineSimilarityOverRealVectors(t *testing.T) {
	h := newHarness(t)

	// "alpha" appears in both the near and the keyword-only memo; the middle
	// memo is reachable only through its vector.
	near := h.seedMemoRow(t, "alpha near duplicate", "topic")
	middle := h.seedMemoRow(t, "unrelated wording", "topic")
	keywordOnly := h.seedMemoRow(t, "alpha without any embedding", "topic")

	h.seedEmbedding(t, near, []float32{1, 0, 0, 0})
	h.seedEmbedding(t, middle, []float32{0.8, 0.6, 0, 0})
	// keywordOnly deliberately gets no embedding row.

	// The query vector is supplied through the injectable boundary, so no
	// provider is contacted.
	h.embedder.setVector([]float32{1, 0, 0, 0})

	body := h.search(t, "alpha")
	if !body.SemanticEnabled {
		t.Fatal("semanticEnabled = false, want true when an embedding was produced")
	}
	if h.embedder.lastText() != "alpha" {
		t.Errorf("the embedder saw %q, want the query text", h.embedder.lastText())
	}

	order := make([]uuid.UUID, 0, len(body.Memos))
	for _, memo := range body.Memos {
		order = append(order, uuid.MustParse(memo.ID))
	}
	if len(order) != 3 {
		t.Fatalf("returned %d memos, want 3 (%v)", len(order), order)
	}
	if order[0] != near.id {
		t.Errorf("first = %v, want the memo closest to the query (%v)", order[0], near.id)
	}
	if order[1] != middle.id {
		t.Errorf("second = %v, want the semantically-near memo %v", order[1], middle.id)
	}
	if order[2] != keywordOnly.id {
		t.Errorf("third = %v, want the keyword-only memo %v", order[2], keywordOnly.id)
	}

	// The near memo matched both legs; the middle one only semantically; the
	// keyword-only one only by keyword.
	byID := map[string]float64{}
	matchType := map[string]string{}
	semantic := map[string]float64{}
	for _, memo := range body.Memos {
		byID[memo.ID] = memo.KeywordScore
		matchType[memo.ID] = memo.MatchType
		semantic[memo.ID] = memo.SemanticScore
	}
	if matchType[near.id.String()] != "hybrid" && matchType[near.id.String()] != "keyword" {
		t.Errorf("near matchType = %q", matchType[near.id.String()])
	}
	if matchType[middle.id.String()] != "semantic" {
		t.Errorf("middle matchType = %q, want semantic", matchType[middle.id.String()])
	}
	if matchType[keywordOnly.id.String()] != "keyword" {
		t.Errorf("keyword-only matchType = %q, want keyword", matchType[keywordOnly.id.String()])
	}
	if semantic[middle.id.String()] <= semantic[keywordOnly.id.String()] {
		t.Errorf("the keyword-only memo scored semantically (%v) at least as high as the near one (%v)",
			semantic[keywordOnly.id.String()], semantic[middle.id.String()])
	}
}

// TestSearchFallsBackToKeywordWhenNoEmbeddingIsProduced proves the flag and the
// behaviour both change when the embedder yields nothing.
func TestSearchFallsBackToKeywordWhenNoEmbeddingIsProduced(t *testing.T) {
	h := newHarness(t)

	match := h.seedMemoRow(t, "alpha memo", "topic")
	h.seedEmbedding(t, match, []float32{1, 0, 0, 0})

	h.embedder.setError(fmt.Errorf("provider unavailable"))

	body, raw := h.searchRaw(t, "alpha")
	if body.SemanticEnabled {
		t.Error("semanticEnabled = true, want false when no embedding was produced")
	}
	if len(body.Memos) != 1 || body.Memos[0].ID != match.id.String() {
		t.Fatalf("keyword fallback returned %d memos, want the matching one", len(body.Memos))
	}

	// The keyword branch keeps the original item shape: the delivered body must
	// not carry the hybrid score fields. It has to be checked against the raw
	// bytes, because decoding into the richer struct would synthesise them.
	for _, field := range []string{"keywordScore", "semanticScore", "matchType"} {
		if strings.Contains(string(raw), field) {
			t.Errorf("the keyword fallback body carries %q: %s", field, raw)
		}
	}
}

// TestMemoryContextOrdersCandidatesByCosineSimilarity proves the memory path
// that gathers background for a bot ranks by the stored vectors.
func TestMemoryContextOrdersCandidatesByCosineSimilarity(t *testing.T) {
	h := newHarness(t)

	anchor := h.seedMemoRow(t, "the anchor entry", "topic")
	nearest := h.seedMemoRow(t, "the nearest entry", "topic")
	middle := h.seedMemoRow(t, "the middle entry", "topic")
	furthest := h.seedMemoRow(t, "the furthest entry", "topic")

	h.seedEmbedding(t, anchor, []float32{1, 0, 0, 0})
	h.seedEmbedding(t, nearest, []float32{1, 0, 0, 0})      // cosine 1.0
	h.seedEmbedding(t, middle, []float32{0.8, 0.6, 0, 0})   // cosine 0.8
	h.seedEmbedding(t, furthest, []float32{0.6, 0.8, 0, 0}) // cosine 0.6

	rec := h.do(t, http.MethodGet,
		fmt.Sprintf("/api/memory/context?memoId=%s&botId=%s", anchor.id, uuid.New()), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("memory context = %d, want 200 (body %s)", rec.Code, rec.Body)
	}

	// The items carry the identifier as "id" and the fused relevance as "score".
	var body struct {
		SimilarMemos []struct {
			ID     string  `json:"id"`
			Score  float64 `json:"score"`
			Reason string  `json:"reason"`
		} `json:"similarMemos"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding the response: %v", err)
	}

	if len(body.SimilarMemos) != 3 {
		t.Fatalf("returned %d candidates, want 3 above the semantic floor", len(body.SimilarMemos))
	}

	got := []string{
		body.SimilarMemos[0].ID,
		body.SimilarMemos[1].ID,
		body.SimilarMemos[2].ID,
	}
	want := []string{nearest.id.String(), middle.id.String(), furthest.id.String()}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("candidate order = %v, want %v (nearest first)", got, want)
		}
	}

	// The scores must fall away with the distance from the query vector.
	if body.SimilarMemos[0].Score <= body.SimilarMemos[2].Score {
		t.Errorf("scores do not fall with distance: %v", body.SimilarMemos)
	}
	for _, candidate := range body.SimilarMemos {
		if !strings.Contains(candidate.Reason, "semantic") {
			t.Errorf("candidate %s reason = %q, want it to include semantic", candidate.ID, candidate.Reason)
		}
	}
}

// search drives the real search endpoint and decodes its body.
func (h *harness) search(t *testing.T, query string) searchResponse {
	t.Helper()
	body, _ := h.searchRaw(t, query)
	return body
}

// searchRaw returns both the decoded response and the delivered bytes.
func (h *harness) searchRaw(t *testing.T, query string) (searchResponse, []byte) {
	t.Helper()

	rec := h.do(t, http.MethodGet, "/api/memos/search?query="+query, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("search = %d, want 200 (body %s)", rec.Code, rec.Body)
	}

	var body searchResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding the search response: %v", err)
	}
	return body, rec.Body.Bytes()
}
