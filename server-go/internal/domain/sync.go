package domain

import "github.com/google/uuid"

// Sync entity names. These are the keys of the change map and of the cursor map.
const (
	SyncEntityMemo     = "memo"
	SyncEntityDiary    = "diary"
	SyncEntityResource = "resource"
	SyncEntityBot      = "bot"
)

// SyncEntities is the fixed, ordered set of entities a pull reports on.
var SyncEntities = []string{
	SyncEntityMemo,
	SyncEntityDiary,
	SyncEntityResource,
	SyncEntityBot,
}

// SyncPageLimit caps how many changed rows one entity reports per pull. It
// matches the previous server's LIMIT so a cursor always makes forward progress.
const SyncPageLimit = 200

// EntityChangeSet is one entity's contribution to a pull: the rows that changed,
// plus the identifiers that disappeared.
type EntityChangeSet struct {
	Updated    []map[string]any `json:"updated"`
	DeletedIDs []string         `json:"deletedIds"`
}

// NewEntityChangeSet returns an empty set with non-nil slices, so the JSON is
// `[]` rather than `null`.
func NewEntityChangeSet() EntityChangeSet {
	return EntityChangeSet{Updated: []map[string]any{}, DeletedIDs: []string{}}
}

// EntityChanges holds one change set per entity.
type EntityChanges struct {
	Memo     EntityChangeSet `json:"memo"`
	Diary    EntityChangeSet `json:"diary"`
	Resource EntityChangeSet `json:"resource"`
	Bot      EntityChangeSet `json:"bot"`
}

// SyncPullResult is the body returned by POST /api/sync/pull.
type SyncPullResult struct {
	Cursors map[string]int64 `json:"cursors"`
	Changes EntityChanges    `json:"changes"`
}

// MemoChange is the row shape the memo change set serializes.
type MemoChange struct {
	ID         uuid.UUID
	Content    string
	Tags       []string
	IsArchived bool
	DiaryDate  *Date
	AiSummary  *string
	CreatedAt  int64
	UpdatedAt  int64
}

// DiaryChange is the row shape the diary change set serializes.
type DiaryChange struct {
	Date      Date
	Summary   string
	MoodKey   string
	MoodScore int32
	CreatedAt int64
	UpdatedAt int64
}

// ResourceChange is the row shape the resource change set serializes.
type ResourceChange struct {
	ID           uuid.UUID
	MemoID       *uuid.UUID
	Filename     string
	ResourceType string
	MimeType     string
	FileSize     int64
	StorageType  string
	CreatedAt    int64
}

// BotChange is the row shape the bot change set serializes.
type BotChange struct {
	ID          uuid.UUID
	Name        string
	AvatarURL   *string
	Description string
	Tags        []string
	AutoReply   bool
	SortOrder   int32
	CreatedAt   int64
	UpdatedAt   int64
}
