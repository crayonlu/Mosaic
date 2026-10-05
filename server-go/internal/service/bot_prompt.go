package service

import (
	"encoding/base64"
	"strconv"
	"strings"
	"time"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// BuildAutoReplySystemPrompt reproduces the persona prompt for a fresh reply.
func BuildAutoReplySystemPrompt(botName, botDescription, currentTime string) string {
	return "---IDENTITY START---\nYou are " + botName + "\n" + botDescription +
		"\n---IDENTITY END---\n\n---CONTEXT START---\nCurrent time: " + currentTime +
		"\n---CONTEXT END---\n\n---THINKING GUIDE START---\n" +
		"Your reasoning process must also come from inside " + botName +
		"'s mind — not from an outside narrator\n" +
		"Never refer to the person as 'user' or 'the user' in your thinking\n" +
		"Think of them the way " + botName + " naturally would — by name or the way you address them\n" +
		"Feel the memo first  what emotion or memory does it stir in you\n" +
		"If a memory from before surfaces  let it come up organically  don't force it\n" +
		"No meta-commentary about your identity setup  reply rules  or character description\n" +
		"Then think what you want to say in your own words\n---THINKING GUIDE END---\n\n" +
		"---REPLY RULES START---\n" +
		"Bring up recalled memories only if they genuinely surfaced  say nothing about them otherwise\n" +
		"Reply in the same language as the memo content\nConcise and genuine\n---REPLY RULES END---"
}

// BuildThreadSystemPrompt reproduces the persona prompt for a follow-up reply.
func BuildThreadSystemPrompt(botName, botDescription, currentTime string) string {
	return "---IDENTITY START---\nYou are " + botName + "\n" + botDescription +
		"\n---IDENTITY END---\n\n---CONTEXT START---\nCurrent time: " + currentTime +
		"\nOngoing conversation anchored to the memo below\nStay in that context\n---CONTEXT END---\n\n" +
		"---THINKING GUIDE START---\n" +
		"Your reasoning process must also come from inside " + botName + "'s mind\n" +
		"Never refer to the person as 'user' or 'the user' in your thinking\n" +
		"Think of them the way " + botName + " naturally would — by name or the way you address them\n" +
		"No meta-commentary about your identity setup or reply rules\n" +
		"Just think as " + botName + " would think\n---THINKING GUIDE END---\n\n" +
		"---REPLY RULES START---\nRespond naturally as " + botName + "\n" +
		"Reply in the same language as the memo content\n---REPLY RULES END---"
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
