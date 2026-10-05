package aiclient

import (
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// SystemPrompt is the instruction prepended to every content-processing call.
// It is reproduced verbatim from the previous server.
const SystemPrompt = "You are a helpful assistant that processes user content.\n" +
	"CRITICAL: You MUST ALWAYS respond in the SAME LANGUAGE as the user's input content.\n" +
	"- If the input is in Chinese, respond in Chinese.\n" +
	"- If the input is in Japanese, respond in Japanese.\n" +
	"- If the input is in Korean, respond in Korean.\n" +
	"- If the input is in English, respond in English.\n" +
	"- And so on for any language.\n" +
	"This is the most important rule. Never violate it."

// Message is one entry in a chat-completions conversation. Content is a string
// for plain text or a slice of content parts for vision inputs; encoding/json
// renders either shape correctly.
type Message struct {
	Role    string `json:"role"`
	Content any    `json:"content"`
}

// ChatRequest is the body sent to POST {base}/chat/completions.
type ChatRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	MaxTokens   int       `json:"max_tokens"`
	Temperature float64   `json:"temperature"`
}

// EmbeddingRequest is the body sent to POST {base}/embeddings.
type EmbeddingRequest struct {
	Model string `json:"model"`
	Input string `json:"input"`
}

// BuildChatRequest assembles a completion request, prepending the system prompt
// exactly as the previous server did.
func BuildChatRequest(
	systemPrompt string,
	messages []Message,
	model string,
	temperature float64,
	maxTokens int,
) ChatRequest {
	full := make([]Message, 0, len(messages)+1)
	full = append(full, Message{Role: "system", Content: systemPrompt})
	full = append(full, messages...)
	return ChatRequest{
		Model:       model,
		Messages:    full,
		MaxTokens:   maxTokens,
		Temperature: temperature,
	}
}

// BuildEmbeddingRequest assembles an embeddings request.
func BuildEmbeddingRequest(model, input string) EmbeddingRequest {
	return EmbeddingRequest{Model: model, Input: input}
}

// ExtractJSON returns the JSON value embedded in a model completion. Providers
// frequently wrap the value in a markdown code fence or prefix it with a short
// sentence, so the text is normalised and the first valid JSON array or object
// is located, matching the previous server.
func ExtractJSON(raw string) (string, error) {
	cleaned := stripCodeFences(strings.TrimSpace(raw))
	if cleaned == "" {
		return "", domain.Internal(errors.New("ai response was empty"))
	}
	if json.Valid([]byte(cleaned)) {
		return cleaned, nil
	}
	if value, ok := boundedJSON(cleaned, '[', ']'); ok {
		return value, nil
	}
	if value, ok := boundedJSON(cleaned, '{', '}'); ok {
		return value, nil
	}
	return "", domain.Internal(fmt.Errorf("ai response contained no JSON value: %s", cleaned))
}

// maxTags bounds a generated tag list, unchanged from the previous server.
const maxTags = 4

// ParseTagList turns raw model output into a de-duplicated, normalised list of
// at most maxTags tags. It accepts a JSON array, a JSON object with a "tags" or
// "labels" key, or delimited plain text, in that order, matching the previous
// server's parse_tag_list.
func ParseTagList(raw string) ([]string, error) {
	text := strings.TrimSpace(raw)
	if text == "" {
		return nil, domain.Internal(errors.New("ai returned an empty tag response"))
	}
	cleaned := stripCodeFences(text)

	candidates := collectFromJSON(cleaned)
	if len(candidates) == 0 {
		if value, ok := boundedJSON(cleaned, '[', ']'); ok {
			candidates = collectFromJSON(value)
		}
	}
	if len(candidates) == 0 {
		if value, ok := boundedJSON(cleaned, '{', '}'); ok {
			candidates = collectFromJSON(value)
		}
	}
	if len(candidates) == 0 {
		candidates = collectDelimited(cleaned)
	}

	seen := make(map[string]struct{}, maxTags)
	tags := make([]string, 0, maxTags)
	for _, candidate := range candidates {
		tag := normalizeTag(candidate)
		if tag == "" {
			continue
		}
		key := strings.ToLower(tag)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		tags = append(tags, tag)
		if len(tags) == maxTags {
			break
		}
	}
	if len(tags) == 0 {
		return nil, domain.Internal(fmt.Errorf("ai returned no usable tags: %s", cleaned))
	}
	return tags, nil
}

// ParseEmbeddingResponse extracts the vector from an OpenAI-shaped embeddings
// payload. Non-numeric entries read as zero, matching the previous server's
// tolerance for loosely typed providers.
func ParseEmbeddingResponse(body []byte) ([]float32, error) {
	var payload struct {
		Data []struct {
			Embedding []json.RawMessage `json:"embedding"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, domain.Internal(fmt.Errorf("embedding response parse failed: %w", err))
	}
	if len(payload.Data) == 0 || payload.Data[0].Embedding == nil {
		return nil, domain.Internal(errors.New("embedding payload missing vector"))
	}
	raw := payload.Data[0].Embedding
	embedding := make([]float32, len(raw))
	for i, item := range raw {
		var value float64
		_ = json.Unmarshal(item, &value) // non-numeric entries stay zero
		embedding[i] = float32(value)
	}
	return embedding, nil
}

// stripCodeFences removes the markdown fence a provider may wrap around a JSON
// payload. The previous server removed repeated leading fence prefixes, so this
// loops rather than trimming once.
func stripCodeFences(text string) string {
	for _, prefix := range []string{"```json", "```JSON", "```"} {
		for strings.HasPrefix(text, prefix) {
			text = text[len(prefix):]
		}
	}
	for strings.HasSuffix(text, "```") {
		text = text[:len(text)-len("```")]
	}
	return strings.TrimSpace(text)
}

// boundedJSON returns the substring from the first open byte to the last close
// byte when that substring is valid JSON. The previous server requires the open
// index to precede the close index, so an empty span is rejected.
func boundedJSON(text string, open, close byte) (string, bool) {
	start := strings.IndexByte(text, open)
	end := strings.LastIndexByte(text, close)
	if start < 0 || end <= start {
		return "", false
	}
	candidate := text[start : end+1]
	if !json.Valid([]byte(candidate)) {
		return "", false
	}
	return candidate, true
}

// collectFromJSON parses text and collects tag values from it, returning nil
// when text is not valid JSON.
func collectFromJSON(text string) []string {
	var value any
	if err := json.Unmarshal([]byte(text), &value); err != nil {
		return nil
	}
	var out []string
	collectTagValues(value, &out)
	return out
}

// collectTagValues walks a decoded JSON value the same way the previous server
// did: string elements of an array are tags, and an object only contributes the
// values of its "tags" or "labels" keys (recursively).
func collectTagValues(value any, out *[]string) {
	switch v := value.(type) {
	case []any:
		for _, item := range v {
			if tag, ok := item.(string); ok {
				*out = append(*out, tag)
			}
		}
	case map[string]any:
		// serde_json walks object keys in sorted order; sorting keeps both
		// "labels" and "tags" deterministic when an object carries both.
		keys := make([]string, 0, len(v))
		for key := range v {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		for _, key := range keys {
			if strings.EqualFold(key, "tags") || strings.EqualFold(key, "labels") {
				collectTagValues(v[key], out)
			}
		}
	}
}

// collectDelimited is the last-resort fallback: split plain text by line and
// then by the delimiters the previous server accepted. Empty fields are dropped
// by FieldsFunc, which matches the later empty filter.
func collectDelimited(text string) []string {
	isDelimiter := func(r rune) bool {
		switch r {
		case ',', '，', '、', ';', '；':
			return true
		}
		return false
	}
	var out []string
	for _, line := range strings.Split(text, "\n") {
		for _, field := range strings.FieldsFunc(line, isDelimiter) {
			if tag := normalizeTag(field); tag != "" {
				out = append(out, tag)
			}
		}
	}
	return out
}

// normalizeTag trims and normalises one tag. When the value is prefixed by a
// tag/label marker (in English or Chinese), the marker is dropped, then the
// surrounding punctuation and whitespace the previous server stripped are
// removed from both ends.
func normalizeTag(value string) string {
	tag := strings.TrimSpace(value)

	separator, separatorLen := -1, 0
	for i, r := range tag {
		if r == ':' || r == '：' {
			separator, separatorLen = i, utf8.RuneLen(r)
			break
		}
	}
	if separator >= 0 {
		prefix := strings.ToLower(strings.TrimSpace(tag[:separator]))
		if strings.Contains(prefix, "tag") ||
			strings.Contains(prefix, "label") ||
			strings.Contains(prefix, "标签") {
			tag = tag[separator+separatorLen:]
		}
	}

	return strings.TrimFunc(tag, func(r rune) bool {
		if unicode.IsSpace(r) {
			return true
		}
		switch r {
		case '"', '\'', '`', '[', ']', '{', '}', '-', '*', '#', '•':
			return true
		}
		return false
	})
}
