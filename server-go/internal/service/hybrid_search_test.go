package service

import (
	"testing"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

func hit(id uuid.UUID, keyword, semantic float64) domain.HybridHit {
	return domain.HybridHit{
		Memo:          domain.Memo{ID: id, Content: "memo " + id.String()},
		KeywordScore:  keyword,
		SemanticScore: semantic,
	}
}

// TestFusionWeights pins the 0.6 semantic / 0.4 keyword blend the previous
// server used.
func TestFusionWeights(t *testing.T) {
	cases := []struct {
		keyword, semantic, want float64
	}{
		{1.0, 0.0, 0.4},
		{0.0, 1.0, 0.6},
		{1.0, 1.0, 1.0},
		{0.0, 0.5, 0.3},
	}
	for _, tc := range cases {
		got := FuseHybridScores(tc.keyword, tc.semantic)
		if diff := got - tc.want; diff > 1e-9 || diff < -1e-9 {
			t.Errorf("FuseHybridScores(%v, %v) = %v, want %v",
				tc.keyword, tc.semantic, got, tc.want)
		}
	}
}

func TestHybridMatchType(t *testing.T) {
	cases := []struct {
		keyword, semantic float64
		want              string
	}{
		{1.0, 0.9, domain.MatchTypeHybrid},
		{1.0, 0.0, domain.MatchTypeKeyword},
		{0.0, 0.9, domain.MatchTypeSemantic},
	}
	for _, tc := range cases {
		if got := HybridMatchType(tc.keyword, tc.semantic); got != tc.want {
			t.Errorf("HybridMatchType(%v, %v) = %q, want %q",
				tc.keyword, tc.semantic, got, tc.want)
		}
	}
}

// TestRankingOrdersByFusedScore proves a memo that is only semantically close
// outranks one that merely shares a keyword when the embedding leg is active.
func TestRankingOrdersByFusedScore(t *testing.T) {
	strongSemantic := uuid.New()
	keywordOnly := uuid.New()
	both := uuid.New()

	ranked := RankHybridHits([]domain.HybridHit{
		hit(keywordOnly, 1.0, 0.0),
		hit(strongSemantic, 0.0, 1.0),
		hit(both, 1.0, 0.95),
	}, true)

	if len(ranked) != 3 {
		t.Fatalf("ranked %d hits, want 3", len(ranked))
	}
	if ranked[0].Memo.ID != both {
		t.Errorf("first result = %v, want the memo matched by both legs", ranked[0].Memo.ID)
	}
	if ranked[1].Memo.ID != strongSemantic {
		t.Errorf("second result = %v, want the strongly semantic memo", ranked[1].Memo.ID)
	}
	if ranked[2].Memo.ID != keywordOnly {
		t.Errorf("third result = %v, want the keyword-only memo", ranked[2].Memo.ID)
	}
	if ranked[0].MatchType != domain.MatchTypeHybrid ||
		ranked[1].MatchType != domain.MatchTypeSemantic ||
		ranked[2].MatchType != domain.MatchTypeKeyword {
		t.Errorf("match types = %q, %q, %q",
			ranked[0].MatchType, ranked[1].MatchType, ranked[2].MatchType)
	}
}

// TestSemanticFloorDropsWeakResults proves the 0.2 final-score floor applies
// only when a semantic leg participated.
func TestSemanticFloorDropsWeakResults(t *testing.T) {
	weak := uuid.New()

	withSemantic := RankHybridHits([]domain.HybridHit{hit(weak, 0.0, 0.1)}, true)
	if len(withSemantic) != 0 {
		t.Errorf("weak result survived with a semantic leg: %+v", withSemantic)
	}

	// The same weak row is kept when the search was keyword-only, because the
	// floor only guards semantic noise.
	keywordOnly := RankHybridHits([]domain.HybridHit{hit(weak, 0.0, 0.0)}, false)
	if len(keywordOnly) != 1 {
		t.Errorf("keyword-only ranking dropped a row it should keep")
	}
}

// TestFloorPredicate pins the floor rule itself, including the boundary. It
// asserts the shipped predicate rather than composing arithmetic that cannot be
// represented exactly in binary floating point.
func TestFloorPredicate(t *testing.T) {
	cases := []struct {
		name            string
		finalScore      float64
		semanticEnabled bool
		want            bool
	}{
		{"exactly on the floor", hybridMinimumFinal, true, true},
		{"just below the floor", hybridMinimumFinal - 0.0001, true, false},
		{"well above the floor", 0.9, true, true},
		{"zero with no semantic leg", 0, false, true},
		{"weak keyword-only result", 0.1, false, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := HybridResultSurvives(tc.finalScore, tc.semanticEnabled); got != tc.want {
				t.Errorf("HybridResultSurvives(%v, %v) = %v, want %v",
					tc.finalScore, tc.semanticEnabled, got, tc.want)
			}
		})
	}
}

// TestRankingAppliesTheFloorThroughFusion checks the floor is actually reached
// from real scores, on both sides of it.
func TestRankingAppliesTheFloorThroughFusion(t *testing.T) {
	kept := uuid.New()
	dropped := uuid.New()

	ranked := RankHybridHits([]domain.HybridHit{
		hit(kept, 0.0, 0.9),    // 0.54, well above
		hit(dropped, 0.0, 0.1), // 0.06, well below
	}, true)

	if len(ranked) != 1 {
		t.Fatalf("ranked %d hits, want only the one above the floor", len(ranked))
	}
	if ranked[0].Memo.ID != kept {
		t.Errorf("kept %v, want %v", ranked[0].Memo.ID, kept)
	}
}

func TestUsableEmbedding(t *testing.T) {
	cases := []struct {
		name      string
		embedding []float32
		err       error
		want      bool
	}{
		{"real vector", []float32{0.1, -0.2, 0.3}, nil, true},
		{"nil", nil, nil, false},
		{"empty", []float32{}, nil, false},
		{"all zero", []float32{0, 0, 0}, nil, false},
		{"provider error", []float32{0.1}, errStub, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := UsableEmbedding(tc.embedding, tc.err); got != tc.want {
				t.Errorf("UsableEmbedding = %v, want %v", got, tc.want)
			}
		})
	}
}

var errStub = stubError("provider unavailable")

type stubError string

func (e stubError) Error() string { return string(e) }
