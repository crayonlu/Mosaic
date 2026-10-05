package domain

import "github.com/google/uuid"

// Bot is a configured AI persona that can reply to memos.
type Bot struct {
	ID          uuid.UUID
	UserID      uuid.UUID
	Name        string
	AvatarURL   *string
	Description string
	Tags        []string
	AutoReply   bool
	SortOrder   int32
	Model       *string
	AIConfig    map[string]any
	IsDeleted   bool
	CreatedAt   int64
	UpdatedAt   int64
}

// BotSummary is the shallow bot reference embedded in reply payloads.
type BotSummary struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	AvatarURL *string   `json:"avatarUrl"`
}

// BotMemoryStats describes what the memory system has built for a bot.
type BotMemoryStats struct {
	TotalContextsBuilt int64  `json:"totalContextsBuilt"`
	LastContextAt      *int64 `json:"lastContextAt"`
}

// BotReply is one message a bot produced for a memo.
type BotReply struct {
	ID              uuid.UUID
	MemoID          uuid.UUID
	BotID           uuid.UUID
	Content         string
	ThinkingContent *string
	ParentReplyID   *uuid.UUID
	UserQuestion    *string
	RevisionNumber  *int32
	CreatedAt       int64
}

// BotReplyNode is a reply plus the replies it spawned.
type BotReplyNode struct {
	Reply         BotReply
	Bot           BotSummary
	Children      []BotReplyNode
	ThreadCount   int64
	LatestReplyID uuid.UUID
}

// BotThreadMessage is one turn in a memo's conversation with a bot.
type BotThreadMessage struct {
	ID              uuid.UUID   `json:"id"`
	Role            string      `json:"role"`
	Content         string      `json:"content"`
	ThinkingContent *string     `json:"thinkingContent"`
	ResourceIDs     []uuid.UUID `json:"resourceIds"`
	CreatedAt       int64       `json:"createdAt"`
}

// BotThread is the full conversation for one bot on one memo.
type BotThread struct {
	MemoID        uuid.UUID
	Bot           BotSummary
	Messages      []BotThreadMessage
	LatestReplyID uuid.UUID
}
