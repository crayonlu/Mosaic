package service

import (
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

func int32Ptr(value int32) *int32 { return &value }

func TestCanonicalRepliesDropsDuplicateRoots(t *testing.T) {
	memoID, botID := uuid.New(), uuid.New()
	root := domain.BotReply{
		ID: uuid.New(), MemoID: memoID, BotID: botID, Content: "root",
		RevisionNumber: int32Ptr(1), CreatedAt: 100,
	}
	child := domain.BotReply{
		ID: uuid.New(), MemoID: memoID, BotID: botID, Content: "child",
		ParentReplyID: &root.ID, UserQuestion: strPtr("why"),
		RevisionNumber: int32Ptr(1), CreatedAt: 200,
	}
	grandchild := domain.BotReply{
		ID: uuid.New(), MemoID: memoID, BotID: botID, Content: "grand",
		ParentReplyID: &child.ID, UserQuestion: strPtr("more"),
		RevisionNumber: int32Ptr(1), CreatedAt: 300,
	}
	duplicateRoot := domain.BotReply{
		ID: uuid.New(), MemoID: memoID, BotID: botID, Content: "duplicate",
		RevisionNumber: int32Ptr(1), CreatedAt: 400,
	}

	rows := []domain.BotReply{root, child, grandchild, duplicateRoot}
	kept, counts, latest := canonicalReplies(rows)
	if len(kept) != 3 {
		t.Fatalf("kept %d replies, want 3", len(kept))
	}
	for _, reply := range kept {
		if reply.ID == duplicateRoot.ID {
			t.Fatal("duplicate root survived")
		}
	}
	key := keyFor(root)
	if counts[key] != 3 {
		t.Errorf("thread count = %d, want 3", counts[key])
	}
	if latest[key] != grandchild.ID {
		t.Errorf("latest = %v, want grandchild", latest[key])
	}
}

func strPtr(value string) *string { return &value }

func TestBuildReplyTreeNestsChildren(t *testing.T) {
	memoID, botID := uuid.New(), uuid.New()
	root := domain.BotReply{
		ID: uuid.New(), MemoID: memoID, BotID: botID, Content: "root",
		RevisionNumber: int32Ptr(1), CreatedAt: 100,
	}
	child := domain.BotReply{
		ID: uuid.New(), MemoID: memoID, BotID: botID, Content: "child",
		ParentReplyID: &root.ID, UserQuestion: strPtr("why"),
		RevisionNumber: int32Ptr(1), CreatedAt: 200,
	}
	summaries := map[uuid.UUID]domain.BotSummary{
		botID: {ID: botID, Name: "Muse"},
	}
	key := keyFor(root)
	nodes := BuildReplyTree(
		[]domain.BotReply{root, child}, summaries,
		map[threadKey]int64{key: 2}, map[threadKey]uuid.UUID{key: child.ID})

	if len(nodes) != 1 {
		t.Fatalf("built %d roots, want 1", len(nodes))
	}
	if nodes[0].Bot.Name != "Muse" {
		t.Errorf("bot summary = %+v", nodes[0].Bot)
	}
	if nodes[0].ThreadCount != 2 || nodes[0].LatestReplyID != child.ID {
		t.Errorf("root metadata = %+v", nodes[0])
	}
	if len(nodes[0].Children) != 1 || nodes[0].Children[0].Reply.ID != child.ID {
		t.Fatalf("children not nested: %+v", nodes[0].Children)
	}
}

func TestBuildThreadMessagesAlternatesRoles(t *testing.T) {
	rootID := uuid.New()
	replies := []threadReply{
		{Reply: domain.BotReply{ID: rootID, Content: "answer", CreatedAt: 100}},
		{
			Reply: domain.BotReply{
				ID: rootID, Content: "follow", UserQuestion: strPtr("why"),
				CreatedAt: 200,
			},
			ResourceIDs: []uuid.UUID{uuid.New()},
		},
	}
	messages := BuildThreadMessages(replies)
	if len(messages) != 3 {
		t.Fatalf("built %d messages, want 3", len(messages))
	}
	if messages[0].Role != "assistant" || messages[0].Content != "answer" {
		t.Errorf("message 0 = %+v", messages[0])
	}
	if messages[1].Role != "user" || messages[1].Content != "why" ||
		len(messages[1].ResourceIDs) != 1 {
		t.Errorf("message 1 = %+v", messages[1])
	}
	if messages[2].Role != "assistant" || len(messages[2].ResourceIDs) != 0 {
		t.Errorf("message 2 = %+v", messages[2])
	}
}

func TestBuildRevisionContext(t *testing.T) {
	if got := BuildRevisionContext(nil); got != "" {
		t.Errorf("empty revisions = %q", got)
	}
	single := BuildRevisionContext([]domain.MemoRevision{{Content: "only"}})
	if single != "only" {
		t.Errorf("single revision = %q", single)
	}

	revisions := []domain.MemoRevision{
		{RevisionNumber: 1, Content: "first", CreatedAt: 1_700_000_000_000},
		{RevisionNumber: 2, Content: "second", CreatedAt: 1_700_000_060_000},
	}
	context := BuildRevisionContext(revisions)
	if !strings.Contains(context, "---Entry #1 (") || !strings.Contains(context, "first") {
		t.Errorf("context missing first entry: %q", context)
	}
	if !strings.Contains(context, "---Current entry (") ||
		!strings.Contains(context, "---End of current entry---") {
		t.Errorf("context missing current entry labels: %q", context)
	}

	many := make([]domain.MemoRevision, 12)
	for i := range many {
		many[i] = domain.MemoRevision{
			RevisionNumber: int32(i + 1),
			Content:        "entry",
			CreatedAt:      int64(i),
		}
	}
	omitted := BuildRevisionContext(many)
	if !strings.Contains(omitted, "[... 2 earlier entries omitted ...]") {
		t.Errorf("large history did not omit: %q", omitted)
	}
}

func TestBuildPromptsContainPersonaAndMemo(t *testing.T) {
	prompt := BuildAutoReplySystemPrompt("Muse", "A calm companion", "2026-10-05 09:00")
	for _, want := range []string{"You are Muse", "A calm companion", "2026-10-05 09:00",
		"---IDENTITY START---", "---REPLY RULES END---"} {
		if !strings.Contains(prompt, want) {
			t.Errorf("prompt missing %q", want)
		}
	}

	block := BuildMemoBlock("memo body", "")
	if block != "---MEMO START---\nmemo body\n---MEMO END---" {
		t.Errorf("memo block = %q", block)
	}
	withMemory := BuildMemoBlock("memo body", "MEM")
	if withMemory != "MEM\n\n---MEMO START---\nmemo body\n---MEMO END---" {
		t.Errorf("memo block with memory = %q", withMemory)
	}
}

func TestBuildAutoReplyMessagesAttachImages(t *testing.T) {
	messages := BuildAutoReplyMessages("body", "", nil)
	if len(messages) != 1 {
		t.Fatalf("messages = %d, want 1", len(messages))
	}
	if content, ok := messages[0].Content.(string); !ok ||
		content != "---MEMO START---\nbody\n---MEMO END---" {
		t.Errorf("message content = %#v", messages[0].Content)
	}

	withImage := BuildUserMessage("hi", []ImageInput{{MimeType: "image/png", Data: []byte("x")}})
	parts, ok := withImage.Content.([]any)
	if !ok || len(parts) != 2 {
		t.Fatalf("multimodal content = %#v", withImage.Content)
	}
}
