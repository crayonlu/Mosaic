package domain

import "github.com/google/uuid"

// DefaultRevisionCount is the revision number a memo starts at.
const DefaultRevisionCount = 1

// Memo is a journal entry.
type Memo struct {
	ID            uuid.UUID
	UserID        uuid.UUID
	Content       string
	Tags          []string
	IsArchived    bool
	IsDeleted     bool
	DiaryDate     *Date
	AiSummary     *string
	CreatedAt     int64
	UpdatedAt     int64
	RevisionCount int32
}

// MemoRevision is one historical version of a memo's editable fields.
type MemoRevision struct {
	ID             uuid.UUID
	MemoID         uuid.UUID
	UserID         uuid.UUID
	RevisionNumber int32
	Content        string
	Tags           []string
	AiSummary      *string
	IsDeleted      bool
	CreatedAt      int64
}

// MemoDetail bundles a memo with its revisions and its bot reply tree.
type MemoDetail struct {
	Memo      Memo
	Resources []Resource
	Revisions []MemoRevision
	// BotReplies is a forest: each root carries its children, the size of its
	// subtree and the newest reply in it, so a client can render a thread
	// without further calls.
	BotReplies []BotReplyNode
}

// MemoListFilter are the filters the list endpoint accepts.
type MemoListFilter struct {
	Page      uint32
	PageSize  uint32
	Archived  *bool
	DiaryDate *Date
	Search    *string
}

// MemoSearchQuery are the filters the search endpoint accepts.
type MemoSearchQuery struct {
	Query      string
	Tags       []string
	StartDate  *string
	EndDate    *string
	IsArchived *bool
	Page       uint32
	PageSize   uint32
}

// TagCount is a tag and how many memos carry it.
type TagCount struct {
	Tag   string `json:"tag"`
	Count int64  `json:"count"`
}

// Paginated is the shared list envelope.
type Paginated[T any] struct {
	Items      []T    `json:"items"`
	Total      int64  `json:"total"`
	Page       uint32 `json:"page"`
	PageSize   uint32 `json:"pageSize"`
	TotalPages uint32 `json:"totalPages"`
}

// NewPaginated builds the envelope, deriving the page count from the total.
func NewPaginated[T any](items []T, total int64, page, pageSize uint32) Paginated[T] {
	totalPages := uint32(0)
	if pageSize > 0 {
		totalPages = uint32((total + int64(pageSize) - 1) / int64(pageSize))
	}
	if items == nil {
		items = []T{}
	}
	return Paginated[T]{
		Items:      items,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	}
}

// NormalizePage applies the shared pagination bounds.
func NormalizePage(page, pageSize uint32, defaultSize uint32) (uint32, uint32) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = defaultSize
	}
	return page, pageSize
}

// TagListFromJSON decodes the tags column, which is stored as a JSON array.
// A malformed value yields an empty list rather than an error, matching the
// previous server.
func TagListFromJSON(raw []byte) []string {
	tags := []string{}
	if len(raw) == 0 {
		return tags
	}
	if err := unmarshalStringList(raw, &tags); err != nil {
		return []string{}
	}
	return tags
}
