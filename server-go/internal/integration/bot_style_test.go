package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/service"
)

func TestBotStyleRulesReachAutoAndFollowupRequests(t *testing.T) {
	h := newHarness(t)
	botID := seedAutoReplyBot(t, h)
	rootContent := "A generated test reply."
	h.chat.setScript(rootContent)
	rec := h.do(t, http.MethodPost, "/api/memos", `{"content":"A fictional memo for integration testing."}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("create = %d: %s", rec.Code, rec.Body)
	}
	memoID := createdMemoID(t, rec)
	var rootID uuid.UUID
	waitFor(t, "the bot reply", func() bool {
		return h.pool.QueryRow(context.Background(),
			`SELECT id FROM bot_replies WHERE memo_id=$1 AND bot_id=$2`, memoID, botID).Scan(&rootID) == nil
	})

	h.chat.mu.Lock()
	requests := append([]service.CompletionRequest(nil), h.chat.requests...)
	h.chat.mu.Unlock()
	var auto *service.CompletionRequest
	for i := range requests {
		if strings.Contains(requests[i].SystemPrompt, "You are auto-responder") {
			auto = &requests[i]
		}
	}
	if auto == nil {
		t.Fatal("no auto reply completion request")
	}
	if auto.SystemPrompt != service.BuildAutoReplySystemPrompt("auto-responder", "integration bot", promptTime(auto.SystemPrompt)) {
		t.Error("auto request did not use the shared prompt builder")
	}

	followContent := "A generated follow-up test reply."
	h.chat.setScript(followContent)
	rec = h.do(t, http.MethodPost, "/api/bot-replies/"+rootID.String()+"/reply",
		`{"question":"A fictional follow-up question?"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("followup = %d: %s", rec.Code, rec.Body)
	}
	var child struct {
		ID      uuid.UUID `json:"id"`
		Content string    `json:"content"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &child); err != nil {
		t.Fatal(err)
	}
	if child.Content != followContent {
		t.Errorf("followup content = %q", child.Content)
	}
	h.chat.mu.Lock()
	follow := h.chat.requests[len(h.chat.requests)-1]
	h.chat.mu.Unlock()
	if follow.SystemPrompt != service.BuildThreadSystemPrompt("auto-responder", "integration bot", promptTime(follow.SystemPrompt)) {
		t.Error("followup request did not use the shared prompt builder")
	}
	if got := follow.Messages[len(follow.Messages)-1]; got.Role != "user" || got.Content != "A fictional follow-up question?" {
		t.Errorf("latest question = %#v", got)
	}
	if len(follow.Messages) < 3 || follow.Messages[1].Content != rootContent {
		t.Errorf("followup lost root reply: %#v", follow.Messages)
	}

	for _, path := range []string{
		"/api/memos/" + memoID.String() + "/detail",
		"/api/memos/" + memoID.String() + "/bot-replies",
		"/api/bot-replies/" + rootID.String() + "/thread",
	} {
		rec = h.do(t, http.MethodGet, path, "")
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), followContent) {
			t.Errorf("%s = %d, missing persisted followup: %s", path, rec.Code, rec.Body)
		}
	}
}

func promptTime(prompt string) string {
	_, rest, _ := strings.Cut(prompt, "Current time: ")
	value, _, _ := strings.Cut(rest, "\n")
	return value
}
