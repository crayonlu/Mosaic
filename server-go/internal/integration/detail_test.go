package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
)

type detailReplyNode struct {
	ID  string `json:"id"`
	Bot struct {
		Name      string  `json:"name"`
		AvatarURL *string `json:"avatarUrl"`
	} `json:"bot"`
	Content       string            `json:"content"`
	Children      []detailReplyNode `json:"children"`
	ThreadCount   int64             `json:"threadCount"`
	LatestReplyID string            `json:"latestReplyId"`
}

type detailResponse struct {
	BotReplies []detailReplyNode `json:"botReplies"`
}

// TestMemoDetailReturnsTheNestedReplyTree seeds a root reply with two
// descendants, one of them two levels deep, and asserts the shipped detail
// handler returns the nesting a client needs to render a thread in one call.
func TestMemoDetailReturnsTheNestedReplyTree(t *testing.T) {
	h := newHarness(t)

	// Build the memo directly so the generation pipeline does not add replies.
	memo := h.seedMemoRow(t, "a memo with a thread")

	botID := seedAutoReplyBot(t, h)
	if _, err := h.pool.Exec(context.Background(),
		`UPDATE bots SET avatar_url = 'https://example.invalid/avatar.png' WHERE id = $1`,
		botID); err != nil {
		t.Fatalf("setting the bot avatar: %v", err)
	}

	now := time.Now().UnixMilli()
	root := insertReply(t, h, memo.id, botID, "root reply", nil, now)
	child := insertReply(t, h, memo.id, botID, "child reply", &root, now+1)
	grandchild := insertReply(t, h, memo.id, botID, "grandchild reply", &child, now+2)

	rec := h.do(t, http.MethodGet, fmt.Sprintf("/api/memos/%s/detail", memo.id), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("detail = %d, want 200 (body %s)", rec.Code, rec.Body)
	}

	var body detailResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding the detail response: %v", err)
	}

	if len(body.BotReplies) != 1 {
		t.Fatalf("returned %d roots, want 1: %s", len(body.BotReplies), rec.Body)
	}

	// threadCount and latestReplyId describe the THREAD a reply belongs to,
	// which is keyed by (memo, bot, revision) — not the node's own subtree.
	// All three replies here share one thread, so every node reports the same
	// pair. This matches the previous server exactly.
	const threadSize = 3

	node := body.BotReplies[0]
	if node.ID != root.String() {
		t.Errorf("root id = %s, want %s", node.ID, root)
	}
	if node.Bot.Name != "auto-responder" {
		t.Errorf("root bot name = %q, want the bot's name", node.Bot.Name)
	}
	if node.Bot.AvatarURL == nil || *node.Bot.AvatarURL == "" {
		t.Errorf("root bot avatar = %v, want the stored URL", node.Bot.AvatarURL)
	}
	if node.ThreadCount != threadSize {
		t.Errorf("root threadCount = %d, want %d", node.ThreadCount, threadSize)
	}
	if node.LatestReplyID != grandchild.String() {
		t.Errorf("root latestReplyId = %s, want the newest in the thread %s",
			node.LatestReplyID, grandchild)
	}
	if len(node.Children) != 1 {
		t.Fatalf("root has %d children, want 1", len(node.Children))
	}

	childNode := node.Children[0]
	if childNode.ID != child.String() {
		t.Errorf("child id = %s, want %s", childNode.ID, child)
	}
	if childNode.ThreadCount != threadSize {
		t.Errorf("child threadCount = %d, want %d", childNode.ThreadCount, threadSize)
	}
	if childNode.LatestReplyID != grandchild.String() {
		t.Errorf("child latestReplyId = %s, want %s", childNode.LatestReplyID, grandchild)
	}
	if childNode.Bot.Name != "auto-responder" {
		t.Errorf("child bot name = %q, want the bot's name", childNode.Bot.Name)
	}
	if len(childNode.Children) != 1 {
		t.Fatalf("child has %d children, want 1", len(childNode.Children))
	}

	leaf := childNode.Children[0]
	if leaf.ID != grandchild.String() {
		t.Errorf("grandchild id = %s, want %s", leaf.ID, grandchild)
	}
	if len(leaf.Children) != 0 {
		t.Errorf("grandchild has %d children, want none", len(leaf.Children))
	}
	if leaf.ThreadCount != threadSize || leaf.LatestReplyID != grandchild.String() {
		t.Errorf("grandchild thread fields = (%d, %s), want (%d, %s)",
			leaf.ThreadCount, leaf.LatestReplyID, threadSize, grandchild)
	}
}

// TestMemoDetailWithoutRepliesReturnsAnEmptyArray keeps the response shape
// stable for a memo nobody has replied to.
func TestMemoDetailWithoutRepliesReturnsAnEmptyArray(t *testing.T) {
	h := newHarness(t)
	memo := h.seedMemoRow(t, "a quiet memo")

	rec := h.do(t, http.MethodGet, fmt.Sprintf("/api/memos/%s/detail", memo.id), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("detail = %d, want 200", rec.Code)
	}

	raw := rec.Body.String()
	if !json.Valid([]byte(raw)) {
		t.Fatalf("the detail body is not JSON: %s", raw)
	}

	var body detailResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding: %v", err)
	}
	if body.BotReplies == nil {
		t.Error("botReplies is null, want an empty array")
	}
	if len(body.BotReplies) != 0 {
		t.Errorf("botReplies has %d entries, want none", len(body.BotReplies))
	}
}

// insertReply stores one reply and returns its identifier. A nil parent makes
// the reply a root.
func insertReply(
	t *testing.T,
	h *harness,
	memoID, botID uuid.UUID,
	content string,
	parent *uuid.UUID,
	createdAt int64,
) uuid.UUID {
	t.Helper()

	var returned uuid.UUID
	var parentValue any
	if parent != nil {
		parentValue = *parent
	}

	err := h.pool.QueryRow(context.Background(),
		`INSERT INTO bot_replies (memo_id, bot_id, content, parent_reply_id, created_at)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		memoID, botID, content, parentValue, createdAt).Scan(&returned)
	if err != nil {
		t.Fatalf("inserting a reply: %v", err)
	}
	return returned
}
