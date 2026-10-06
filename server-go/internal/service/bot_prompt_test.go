package service

import (
	"strings"
	"testing"
)

func TestBotPromptsShareConversationalRules(t *testing.T) {
	for name, build := range map[string]func(string, string, string) string{
		"auto":   BuildAutoReplySystemPrompt,
		"thread": BuildThreadSystemPrompt,
	} {
		t.Run(name, func(t *testing.T) {
			prompt := build("TestBot", "A relaxed fictional test persona.", "2030-01-02 09:00")
			for _, want := range []string{
				"You are TestBot", "A relaxed fictional test persona.", "2030-01-02 09:00",
				botReplyRules, "about 1-4 sentences", "Treat feelings and motives as possibilities",
				"不是……而是……", "A broad shared topic alone is insufficient",
				"connect them only with evidence", "Return only the persona's spoken reply",
				"禁止编造最佳时段", "只有对方求方案", "对动机和因果保留不确定性",
			} {
				if !strings.Contains(prompt, want) {
					t.Errorf("prompt missing %q", want)
				}
			}
			if strings.Contains(prompt, "---THINKING GUIDE START---") {
				t.Error("prompt still requests an internal narrative")
			}
			if strings.Count(prompt, botReplyRules) != 1 {
				t.Error("shared rules must occur once")
			}
		})
	}
}

func TestBotReplyRulesContainNoDemonstrationTurns(t *testing.T) {
	for _, marker := range []string{"对方：", "可回应：", "示范回应", "examples below", "Example:", "User:", "Assistant:"} {
		if strings.Contains(botReplyRules, marker) {
			t.Errorf("shared rules contain a demonstration marker %q", marker)
		}
	}
}

func TestBotPromptsMatchConversationMode(t *testing.T) {
	auto := BuildAutoReplySystemPrompt("Muse", "calm", "now")
	if !strings.Contains(auto, "same language as the memo content") ||
		!strings.Contains(auto, "only images, use the persona's language") {
		t.Error("auto reply must handle text and image-only language selection")
	}
	thread := BuildThreadSystemPrompt("Muse", "calm", "now")
	for _, want := range []string{
		"Answer the latest message directly", "without repeating their analysis",
		"Accept corrections", "Historical assistant claims may be mistaken",
		"language of the latest message",
	} {
		if !strings.Contains(thread, want) {
			t.Errorf("thread prompt missing %q", want)
		}
	}
}

func TestThreadReplyMessagesPreserveLatestTurnAndImages(t *testing.T) {
	history := []ChatMessage{
		{Role: "assistant", Content: "Earlier answer"},
		{Role: "user", Content: "Correction"},
		{Role: "assistant", Content: "Corrected answer"},
	}
	images := []ImageInput{{MimeType: "image/png", Data: []byte("image")}}
	messages := BuildThreadReplyMessages("memo", "memory", history, "最新追问", images)
	if len(messages) != 5 {
		t.Fatalf("messages = %d, want 5", len(messages))
	}
	if messages[0].Content != BuildMemoBlock("memo", "memory") {
		t.Error("memo anchor and memory were changed")
	}
	for i, message := range history {
		if messages[i+1] != message {
			t.Errorf("history turn %d changed", i)
		}
	}
	parts, ok := messages[4].Content.([]any)
	if !ok || len(parts) != 2 || messages[4].Role != "user" {
		t.Fatalf("latest multimodal turn = %#v", messages[4])
	}
	if parts[0].(map[string]any)["text"] != "最新追问" {
		t.Error("latest question was lost")
	}
}

func TestBotReplyRulesDoNotAlterStructuredGenerationPrompts(t *testing.T) {
	prompts := []string{BuildDiarySystemPrompt(), BuildClipSystemPrompt("text")}
	for _, prompt := range prompts {
		if strings.Contains(prompt, botReplyRules) {
			t.Error("conversational rules leaked into structured output")
		}
	}
}
