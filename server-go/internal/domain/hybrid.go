package domain

import "github.com/google/uuid"

// Hybrid search limits, reproduced from the previous server.
const (
	// HybridKeywordLimit caps the keyword leg of a hybrid search.
	HybridKeywordLimit = 200
	// HybridSemanticLimit caps the semantic leg.
	HybridSemanticLimit = 50
	// HybridSemanticFloor is the cosine similarity below which a stored
	// embedding is not considered a match at all.
	HybridSemanticFloor = 0.4
)

// Match types a fused result can carry, as the API reports them.
const (
	MatchTypeHybrid   = "hybrid"
	MatchTypeKeyword  = "keyword"
	MatchTypeSemantic = "semantic"
)

// HybridSearchFilter carries everything one hybrid search needs: the free-text
// query, the structured filters, and the query embedding. A nil Embedding means
// the semantic leg is skipped entirely.
type HybridSearchFilter struct {
	Query      string
	Tags       []string
	IsArchived *bool
	FromMS     *int64
	ToMS       *int64
	Embedding  []float32
}

// Semantic reports whether this filter asks for vector retrieval.
func (f HybridSearchFilter) Semantic() bool { return len(f.Embedding) > 0 }

// HybridHit is one memo a hybrid search matched, before ranking. The two scores
// are what the pure fusion step consumes.
type HybridHit struct {
	Memo          Memo
	KeywordScore  float64
	SemanticScore float64
}

// RankedMemo is a hit after fusion, ready to be paginated and rendered.
type RankedMemo struct {
	Memo          Memo
	KeywordScore  float64
	SemanticScore float64
	FinalScore    float64
	MatchType     string
}

// MemoID exposes the identifier for grouping and debugging.
func (r RankedMemo) MemoID() uuid.UUID { return r.Memo.ID }
