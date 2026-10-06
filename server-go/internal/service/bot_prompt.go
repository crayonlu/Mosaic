package service

import (
	"encoding/base64"
	"strconv"
	"strings"
	"time"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// BuildAutoReplySystemPrompt builds the persona and conversational reply rules.
func BuildAutoReplySystemPrompt(botName, botDescription, currentTime string) string {
	return buildBotSystemPrompt(botName, botDescription, currentTime,
		"Respond to the current memo and any attached images. A memo may simply share a moment.\n"+
			"Reply in the same language as the memo content. If it contains only images, use the persona's language.")
}

// BuildThreadSystemPrompt applies the same style rules to a follow-up reply.
func BuildThreadSystemPrompt(botName, botDescription, currentTime string) string {
	return buildBotSystemPrompt(botName, botDescription, currentTime,
		"The memo anchors an ongoing conversation. Answer the latest message directly.\n"+
			"Use earlier turns as context and build on them without repeating their analysis.\n"+
			"Accept corrections and update the answer. Historical assistant claims may be mistaken.\n"+
			"Reply in the language of the latest message unless it requests another language.")
}

func buildBotSystemPrompt(botName, botDescription, currentTime, contextGuide string) string {
	return "---IDENTITY START---\nYou are " + botName + "\n" + botDescription +
		"\n---IDENTITY END---\n\n---CONTEXT START---\nCurrent time: " + currentTime +
		"\n" + contextGuide + "\n---CONTEXT END---\n\n" +
		"---REPLY RULES START---\n" + botReplyRules + "\n---REPLY RULES END---"
}

// BuildMemoBlock wraps a memo body with the memory prefix when one exists.
func BuildMemoBlock(memoContent, memoryPrefix string) string {
	if memoryPrefix == "" {
		return "---MEMO START---\n" + memoContent + "\n---MEMO END---"
	}
	return memoryPrefix + "\n\n---MEMO START---\n" + memoContent + "\n---MEMO END---"
}

// BuildUserMessage renders a user turn, attaching images as data URLs.
func BuildUserMessage(text string, images []ImageInput) ChatMessage {
	if len(images) == 0 {
		return ChatMessage{Role: "user", Content: text}
	}
	parts := make([]any, 0, len(images)+1)
	parts = append(parts, map[string]any{"type": "text", "text": text})
	for _, image := range images {
		encoded := base64.StdEncoding.EncodeToString(image.Data)
		parts = append(parts, map[string]any{
			"type": "image_url",
			"image_url": map[string]any{
				"url": "data:" + image.MimeType + ";base64," + encoded,
			},
		})
	}
	return ChatMessage{Role: "user", Content: parts}
}

// BuildAutoReplyMessages assembles the single-turn messages of a fresh reply.
func BuildAutoReplyMessages(
	memoContent, memoryPrefix string,
	images []ImageInput,
) []ChatMessage {
	return []ChatMessage{BuildUserMessage(BuildMemoBlock(memoContent, memoryPrefix), images)}
}

// BuildThreadReplyMessages assembles the memo anchor, conversation history and
// the new question for a follow-up reply.
func BuildThreadReplyMessages(
	memoContent, memoryPrefix string,
	history []ChatMessage,
	question string,
	images []ImageInput,
) []ChatMessage {
	messages := make([]ChatMessage, 0, len(history)+2)
	messages = append(messages, ChatMessage{
		Role: "user", Content: BuildMemoBlock(memoContent, memoryPrefix),
	})
	messages = append(messages, history...)
	messages = append(messages, BuildUserMessage(question, images))
	return messages
}

// FormatCurrentTime renders the timestamp a prompt reports.
func FormatCurrentTime(nowMs int64, loc *time.Location) string {
	return time.UnixMilli(nowMs).In(loc).Format("2006-01-02 15:04")
}

// BuildRevisionContext renders a memo's revision history into one prompt block.
func BuildRevisionContext(revisions []domain.MemoRevision) string {
	if len(revisions) <= 1 {
		if len(revisions) == 1 {
			return revisions[0].Content
		}
		return ""
	}

	selected := revisions
	if len(revisions) > 10 {
		omitted := make([]domain.MemoRevision, 0, 12)
		omitted = append(omitted, revisions[0])
		omitted = append(omitted, domain.MemoRevision{
			RevisionNumber: -1,
			Content: "[... " + strconv.Itoa(len(revisions)-10) +
				" earlier entries omitted ...]",
		})
		omitted = append(omitted, revisions[len(revisions)-9:]...)
		selected = omitted
	}

	parts := make([]string, 0, len(selected))
	for i, revision := range selected {
		if revision.RevisionNumber == -1 {
			parts = append(parts, revision.Content)
			continue
		}
		ts := time.UnixMilli(revision.CreatedAt).UTC().Format("2006-01-02 15:04")
		label := "---Entry #" + strconv.Itoa(int(revision.RevisionNumber)) + " (" + ts + ")---"
		endLabel := "---End of entry #" + strconv.Itoa(int(revision.RevisionNumber)) + "---"
		if i == len(selected)-1 {
			label = "---Current entry (" + ts + ")---"
			endLabel = "---End of current entry---"
		}
		parts = append(parts, label+"\n"+revision.Content+"\n"+endLabel)
	}
	return strings.Join(parts, "\n\n")
}
