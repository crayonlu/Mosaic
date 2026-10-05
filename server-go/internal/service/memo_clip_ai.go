package service

import (
	"context"
	"strings"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// clipContentLimit is how many characters of a fetched article reach the model,
// matching the previous server.
const clipContentLimit = 8000

// BuildClipSystemPrompt reproduces the previous server's clip prompt verbatim,
// including the delimited output format the response parser reads.
func BuildClipSystemPrompt(clipType string) string {
	instruction := "Extract and refine the user's content."
	switch clipType {
	case "url":
		instruction = "The user has provided a web article in CSX (Compact S-Expression) format — a token-efficient HTML representation where (tag.class children...) encodes DOM structure. Extract the key points and information, and rewrite it concisely."
	case "text":
		instruction = "The user has provided a text passage. Extract the key information and rewrite it concisely."
	case "image":
		instruction = "The user has provided an image. Generate a description and summary based on the image content."
	}

	return "You are a content refinement assistant. " + instruction + `
Use the same language as the provided content.

Output strictly in the following format:

[TITLE]
A concise and compelling title
[/TITLE]

[SUMMARY]
A one-sentence summary
[/SUMMARY]

[CONTENT]
The refined main content, preserving key information while removing noise
[/CONTENT]

[TAGS]
tag1, tag2, tag3 (3-5 tags, comma-separated)
[/TAGS]`
}

// ParseClipResponse reads the model's delimited reply into a clip result. A
// missing title becomes "Untitled", a missing body falls back to the whole
// reply, and tags are split on the separators the previous server accepted.
func ParseClipResponse(raw string) ClipResult {
	trimmed := strings.TrimSpace(raw)

	title, ok := extractClipField(trimmed, "TITLE")
	if !ok || title == "" {
		title = "Untitled"
	}
	summary, _ := extractClipField(trimmed, "SUMMARY")
	tagsField, _ := extractClipField(trimmed, "TAGS")

	body, ok := extractClipField(trimmed, "CONTENT")
	if !ok {
		body = trimmed
	}

	return ClipResult{
		Title:     title,
		Content:   body,
		AiSummary: summary,
		Tags:      splitClipTags(tagsField),
	}
}

// extractClipField returns the text between [FIELD] and [/FIELD].
func extractClipField(text, field string) (string, bool) {
	startTag := "[" + field + "]"
	endTag := "[/" + field + "]"

	start := strings.Index(text, startTag)
	if start < 0 {
		return "", false
	}
	contentStart := start + len(startTag)

	end := strings.Index(text[contentStart:], endTag)
	if end < 0 {
		return "", false
	}
	return strings.TrimSpace(text[contentStart : contentStart+end]), true
}

// splitClipTags splits on the ASCII comma, the full-width comma and whitespace.
func splitClipTags(value string) []string {
	tags := []string{}
	for _, part := range strings.FieldsFunc(value, func(r rune) bool {
		return r == ',' || r == '，' || r == ' '
	}) {
		if tag := strings.TrimSpace(part); tag != "" {
			tags = append(tags, tag)
		}
	}
	return tags
}

// callClipAI asks the model to refine the clip input and parses its reply. A
// nil image list produces a text-only message; an image list attaches the parts
// the provider expects.
func (s *MemoService) callClipAI(
	ctx context.Context,
	config domain.AIConfig,
	input, clipType string,
	images []ImageInput,
) (ClipResult, error) {
	reply, err := s.completions.Complete(ctx, CompletionRequest{
		Config:       config,
		SystemPrompt: BuildClipSystemPrompt(clipType),
		Messages:     []ChatMessage{BuildUserMessage(input, images)},
	})
	if err != nil {
		return ClipResult{}, domain.Internal(err)
	}
	return ParseClipResponse(reply.Content), nil
}

// clipAIInput appends the user's note to a clip input the way the previous
// server did.
func clipAIInput(base string, userNote *string) string {
	note := ""
	if userNote != nil {
		note = strings.TrimSpace(*userNote)
	}
	if note == "" {
		return base
	}
	return base + "\n\n---\n\nUser note: " + note
}
