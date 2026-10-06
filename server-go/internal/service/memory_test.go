package service

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

func TestRankCandidatesFusionBoundaries(t *testing.T) {
	now := int64(1_700_000_000_000)
	anchor := uuid.New()
	candidates := []domain.MemoryCandidate{
		// Below the 0.55 semantic floor: dropped even though very recent.
		{MemoID: uuid.New(), Content: "dropped", VectorScore: 0.54, CreatedAt: now},
		// Exactly at the floor, tagged and fresh: the strongest score.
		{
			MemoID: anchor, Content: "kept", Tags: []string{"a", "b"},
			VectorScore: 0.55, CreatedAt: now,
		},
		// Above the floor but old and untagged.
		{
			MemoID: uuid.New(), Content: "older", VectorScore: 0.6,
			CreatedAt: now - 30*86_400_000,
		},
	}

	ranked := RankCandidates([]string{"a", "b"}, candidates, now, 10)
	if len(ranked) != 2 {
		t.Fatalf("ranked %d candidates, want 2", len(ranked))
	}
	if ranked[0].MemoID != anchor {
		t.Errorf("first result = %v, want the tagged fresh memo", ranked[0].MemoID)
	}
	// 0.55*0.55 + 0.25*1 + 0.20*1 = 0.7525
	if got := ranked[0].RelevanceScore; got < 0.752 || got > 0.753 {
		t.Errorf("top score = %v, want 0.7525", got)
	}
	if ranked[0].Reason != "semantic+recent+tags" {
		t.Errorf("top reason = %q", ranked[0].Reason)
	}
	// 0.55*0.6 + 0.25*exp(-1) + 0 tags = 0.42197...
	if ranked[1].Reason != "semantic" {
		t.Errorf("second reason = %q, want semantic", ranked[1].Reason)
	}
	if got := ranked[1].RelevanceScore; got < 0.421 || got > 0.423 {
		t.Errorf("second score = %v, want ~0.422", got)
	}
}

func TestRankCandidatesLimitAndMissingSemantic(t *testing.T) {
	now := int64(1_700_000_000_000)
	candidates := []domain.MemoryCandidate{
		{MemoID: uuid.New(), Content: "no embedding", CreatedAt: now},
		{MemoID: uuid.New(), Content: "one", VectorScore: 0.9, CreatedAt: now},
		{MemoID: uuid.New(), Content: "two", VectorScore: 0.8, CreatedAt: now},
	}
	ranked := RankCandidates(nil, candidates, now, 1)
	if len(ranked) != 1 {
		t.Fatalf("ranked %d, want 1 after truncation", len(ranked))
	}
	if ranked[0].SummaryExcerpt != "one" {
		t.Errorf("summary = %q, want one", ranked[0].SummaryExcerpt)
	}
}

func TestRankCandidatesTruncatesExcerpt(t *testing.T) {
	now := int64(1_700_000_000_000)
	long := strings.Repeat("x", 200)
	ranked := RankCandidates(nil, []domain.MemoryCandidate{
		{MemoID: uuid.New(), Content: long, VectorScore: 0.9, CreatedAt: now},
	}, now, 10)
	if len(ranked[0].SummaryExcerpt) != 120 {
		t.Errorf("excerpt length = %d, want 120", len(ranked[0].SummaryExcerpt))
	}
}

func TestBuildMemoryPrefixTrimsToBudget(t *testing.T) {
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC).UnixMilli()
	first := domain.RelatedMemoContext{
		MemoID:         uuid.New(),
		SummaryExcerpt: strings.Repeat("a", 1200),
		CreatedAt:      now,
	}
	second := domain.RelatedMemoContext{
		MemoID:         uuid.New(),
		SummaryExcerpt: strings.Repeat("b", 1200),
		CreatedAt:      now - 86_400_000,
	}

	prefix := BuildMemoryPrefix([]domain.RelatedMemoContext{first, second}, now, time.UTC)
	if !strings.Contains(prefix, "today") {
		t.Errorf("prefix missing today label: %q", prefix[:40])
	}
	if strings.Contains(prefix, second.SummaryExcerpt) {
		t.Error("prefix included the second entry beyond the character budget")
	}
	if !strings.HasPrefix(prefix, "---MEMORY START---") ||
		!strings.HasSuffix(prefix, "---MEMORY END---") {
		t.Errorf("unexpected prefix envelope: %q", prefix)
	}
}

func TestBuildMemoryPrefixPreservesRecordBoundariesAndDates(t *testing.T) {
	loc := time.FixedZone("Asia/Shanghai", 8*60*60)
	now := time.Date(2030, 1, 20, 16, 0, 0, 0, loc).UnixMilli()
	first, second := uuid.New(), uuid.New()
	memos := []domain.RelatedMemoContext{
		{MemoID: first, SummaryExcerpt: "Historical test excerpt A", CreatedAt: time.Date(2030, 1, 10, 17, 0, 0, 0, time.UTC).UnixMilli()},
		{MemoID: second, SummaryExcerpt: "Historical test excerpt B", CreatedAt: time.Date(2029, 12, 5, 12, 0, 0, 0, loc).UnixMilli()},
	}
	prefix := BuildMemoryPrefix(memos, now, loc)
	for _, want := range []string{
		"2030-01-11", "2029-12-05", first.String(), second.String(),
		"Historical test excerpt A", "Historical test excerpt B", "possibly AI summaries", "only when directly relevant",
		"Dates describe past records", "unnamed people may be unrelated",
	} {
		if !strings.Contains(prefix, want) {
			t.Errorf("prefix missing %q", want)
		}
	}
}

func TestBuildMemoryPrefixEmpty(t *testing.T) {
	if got := BuildMemoryPrefix(nil, 0, time.UTC); got != "" {
		t.Errorf("prefix = %q, want empty", got)
	}
}

func TestBuildDebugContext(t *testing.T) {
	first := uuid.New()
	second := uuid.New()
	debug := BuildDebugContext([]domain.RelatedMemoContext{
		{MemoID: first, SummaryExcerpt: "abcd"},
		{MemoID: second, SummaryExcerpt: "ef"},
	})
	if debug.CandidateCount != 2 {
		t.Errorf("candidate count = %d, want 2", debug.CandidateCount)
	}
	if len(debug.RetrievedMemoIDs) != 2 || debug.RetrievedMemoIDs[0] != first ||
		debug.RetrievedMemoIDs[1] != second {
		t.Errorf("retrieved ids = %v", debug.RetrievedMemoIDs)
	}
	if debug.PromptChars != 4+4+2+4 {
		t.Errorf("prompt chars = %d, want 14", debug.PromptChars)
	}
}

func TestAssembleRetrievedMemosDefaultsReason(t *testing.T) {
	scored := uuid.New()
	unscored := uuid.New()
	log := MemoryDebugLog{
		RetrievedMemoIDs: []uuid.UUID{scored, unscored},
		Scores:           []MemoryScore{{MemoID: scored, Score: 0.9, Reason: "semantic"}},
	}
	summary := "sum"
	memos := []domain.Memo{
		{ID: scored, Content: "body", CreatedAt: 1},
		{ID: unscored, Content: "other", AiSummary: &summary, CreatedAt: 2},
	}
	items := AssembleRetrievedMemos(log, memos, nil)
	if len(items) != 2 {
		t.Fatalf("assembled %d items, want 2", len(items))
	}
	if items[0].Reason != "semantic" || items[0].RelevanceScore != 0.9 {
		t.Errorf("first item = %+v", items[0])
	}
	if items[1].Reason != "recent" || items[1].SummaryExcerpt != "sum" {
		t.Errorf("second item = %+v", items[1])
	}
}

func TestHybridScoreFusion(t *testing.T) {
	if got := FuseHybridScores(1, 1); got != 1.0 {
		t.Errorf("fused = %v, want 1.0", got)
	}
	if got := FuseHybridScores(1, 0); got != 0.4 {
		t.Errorf("keyword-only fused = %v, want 0.4", got)
	}
	if HybridMatchType(1, 1) != "hybrid" ||
		HybridMatchType(1, 0) != "keyword" ||
		HybridMatchType(0, 1) != "semantic" {
		t.Error("match type classification is wrong")
	}
	if HybridResultSurvives(0.19, true) {
		t.Error("score below the semantic floor should not survive")
	}
	if !HybridResultSurvives(0.0, false) {
		t.Error("keyword-only results survive regardless of the floor")
	}
}

func TestBuildTimelineSummaryGroupsByDay(t *testing.T) {
	loc := time.UTC
	day := time.Date(2026, 10, 5, 9, 0, 0, 0, loc)
	memos := []domain.RelatedMemoContext{
		{MemoID: uuid.New(), SummaryExcerpt: "morning", CreatedAt: day.UnixMilli()},
		{MemoID: uuid.New(), SummaryExcerpt: "evening", CreatedAt: day.Add(8 * time.Hour).UnixMilli()},
	}
	summary := BuildTimelineSummary(memos, loc)
	if summary == nil || !strings.Contains(*summary, "morning; evening") {
		t.Errorf("summary = %v", summary)
	}
	if BuildTimelineSummary(nil, loc) != nil {
		t.Error("empty timeline should return nil")
	}
}

func TestBuildEmbeddingSourceText(t *testing.T) {
	summary := "a summary"
	memo := domain.Memo{
		Content:   "the body",
		Tags:      []string{"work", "health"},
		AiSummary: &summary,
	}
	text := BuildEmbeddingSourceText(memo, "")
	if !strings.Contains(text, "summary: a summary") ||
		!strings.Contains(text, "content: the body") ||
		!strings.Contains(text, "tags: work, health") {
		t.Errorf("source text = %q", text)
	}
	withContext := BuildEmbeddingSourceText(memo, "revision history")
	if !strings.Contains(withContext, "content: revision history") {
		t.Errorf("revision context not used: %q", withContext)
	}
}
