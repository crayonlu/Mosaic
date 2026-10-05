package domain

import "github.com/google/uuid"

// MemoEmbedding is a memo's vector representation.
type MemoEmbedding struct {
	MemoID     uuid.UUID
	SourceText string
	Provider   string
	Model      string
	Embedding  []float32
	UpdatedAt  int64
}

// RelatedMemoContext is a memo surfaced to a bot as relevant background.
type RelatedMemoContext struct {
	MemoID         uuid.UUID `json:"memoId"`
	SummaryExcerpt string    `json:"summaryExcerpt"`
	Tags           []string  `json:"tags"`
	CreatedAt      int64     `json:"createdAt"`
	RelevanceScore float64   `json:"relevanceScore"`
	Reason         string    `json:"reason"`
}

// BotMemoryDebugContext describes how a memory context was assembled.
type BotMemoryDebugContext struct {
	CandidateCount   int         `json:"candidateCount"`
	RetrievedMemoIDs []uuid.UUID `json:"retrievedMemoIds"`
	PromptChars      int         `json:"promptChars"`
}

// BotMemoryContext is the background a bot is given for one reply.
type BotMemoryContext struct {
	SimilarMemos []RelatedMemoContext  `json:"similarMemos"`
	Debug        BotMemoryDebugContext `json:"debug"`
}

// MemoryStats reports how much of a user's history is embedded.
type MemoryStats struct {
	TotalMemos   int64 `json:"totalMemos"`
	IndexedMemos int64 `json:"indexedMemos"`
}

// RetrievalMode selects how candidate memos are gathered.
const (
	RetrievalModeAuto     = "auto"
	RetrievalModeVector   = "vector"
	RetrievalModeKeyword  = "keyword"
	RetrievalModeTimeline = "timeline"
)

// MemoryCandidate is one scored memo before it is trimmed to the prompt budget.
type MemoryCandidate struct {
	MemoID       uuid.UUID
	Content      string
	Tags         []string
	CreatedAt    int64
	VectorScore  float64
	KeywordScore float64
}
