// Package aiclient ports the previous Rust server's OpenAI-compatible AI
// provider client. It speaks the chat-completions and embeddings endpoints over
// net/http and keeps the provider-output wrangling that made auto-tagging
// robust.
package aiclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// Defaults matching the previous server.
const (
	defaultTemperature = 0.8
	defaultMaxTokens   = 512
	defaultTimeout     = 60 * time.Second

	// maxErrorBody bounds how much of a provider error body is echoed into the
	// wrapped cause, and maxResponseBody bounds a successful response read.
	maxErrorBody    = 200
	maxResponseBody = 8 << 20
)

// Config holds the provider settings for a single capability. BaseURL, APIKey
// and Model are required. Temperature, MaxTokens and Timeout fall back to the
// previous server's defaults when left at their zero value.
type Config struct {
	Provider    string
	BaseURL     string
	APIKey      string
	Model       string
	Temperature float64
	MaxTokens   int
	Timeout     time.Duration
}

// Reply is the text returned by a chat completion, plus any reasoning content a
// thinking model emitted.
type Reply struct {
	Content         string
	ThinkingContent string
}

// Client is an OpenAI-compatible provider client. The HTTP transport is injected
// so tests can stand in for the provider rather than defaulting silently.
type Client struct {
	http *http.Client
	cfg  Config
}

// New validates cfg and builds a client over httpClient. A nil transport is
// rejected, as is a config missing a required field, so wiring mistakes surface
// at construction instead of at the first request.
func New(httpClient *http.Client, cfg Config) (*Client, error) {
	if httpClient == nil {
		return nil, domain.InvalidInput("ai client: http client is required")
	}
	if strings.TrimSpace(cfg.BaseURL) == "" {
		return nil, domain.InvalidInput("ai client: base URL is required")
	}
	if strings.TrimSpace(cfg.APIKey) == "" {
		return nil, domain.InvalidInput("ai client: API key is required")
	}
	if strings.TrimSpace(cfg.Model) == "" {
		return nil, domain.InvalidInput("ai client: model is required")
	}
	if cfg.MaxTokens <= 0 {
		cfg.MaxTokens = defaultMaxTokens
	}
	if cfg.Temperature == 0 {
		cfg.Temperature = defaultTemperature
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = defaultTimeout
	}
	return &Client{http: httpClient, cfg: cfg}, nil
}

// ChatCompletion sends a chat completion and returns the provider's first
// choice. systemPrompt is always prepended as the system message, exactly as the
// previous server did. A non-empty modelOverride replaces the configured model,
// which is how per-bot models are selected.
func (c *Client) ChatCompletion(
	ctx context.Context,
	systemPrompt string,
	messages []Message,
	modelOverride string,
) (*Reply, error) {
	model := c.cfg.Model
	if strings.TrimSpace(modelOverride) != "" {
		model = modelOverride
	}
	body, err := json.Marshal(BuildChatRequest(
		systemPrompt, messages, model, c.cfg.Temperature, c.cfg.MaxTokens))
	if err != nil {
		return nil, domain.Internal(fmt.Errorf("encoding ai request: %w", err))
	}

	data, err := c.post(ctx, "/chat/completions", body)
	if err != nil {
		return nil, err
	}

	var payload struct {
		Choices []struct {
			Message struct {
				Content          json.RawMessage `json:"content"`
				ReasoningContent string          `json:"reasoning_content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, domain.Internal(fmt.Errorf("decoding ai response: %w", err))
	}
	if len(payload.Choices) == 0 {
		return nil, domain.Internal(fmt.Errorf(
			"ai response missing choices[0].message for provider %s", c.cfg.Provider))
	}

	message := payload.Choices[0].Message
	content := extractMessageText(message.Content)
	if strings.TrimSpace(content) == "" {
		return nil, domain.Internal(fmt.Errorf(
			"ai response contained no text content for provider %s", c.cfg.Provider))
	}
	return &Reply{Content: content, ThinkingContent: message.ReasoningContent}, nil
}

// Embedding requests a vector for input from the configured embedding model.
func (c *Client) Embedding(ctx context.Context, input string) ([]float32, error) {
	body, err := json.Marshal(BuildEmbeddingRequest(c.cfg.Model, input))
	if err != nil {
		return nil, domain.Internal(fmt.Errorf("encoding embedding request: %w", err))
	}
	data, err := c.post(ctx, "/embeddings", body)
	if err != nil {
		return nil, err
	}
	return ParseEmbeddingResponse(data)
}

// post sends body to path under the configured base URL and returns the
// response body. Every failure, including a non-2xx status, is a *domain.Error.
func (c *Client) post(ctx context.Context, path string, body []byte) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, c.cfg.Timeout)
	defer cancel()

	url := strings.TrimRight(c.cfg.BaseURL, "/") + path
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, domain.Internal(fmt.Errorf("building ai request: %w", err))
	}
	req.Header.Set("Authorization", "Bearer "+c.cfg.APIKey)
	req.Header.Set("Content-Type", "application/json")

	response, err := c.http.Do(req)
	if err != nil {
		return nil, domain.Internal(fmt.Errorf("ai request failed: %w", err))
	}
	defer response.Body.Close()

	data, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBody))
	if err != nil {
		return nil, domain.Internal(fmt.Errorf("reading ai response: %w", err))
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, domain.Internal(fmt.Errorf(
			"ai api returned HTTP %d: %s", response.StatusCode, excerpt(data)))
	}
	return data, nil
}

// excerpt trims a provider body and caps its length for error messages.
func excerpt(body []byte) string {
	text := strings.TrimSpace(string(body))
	if len(text) > maxErrorBody {
		return text[:maxErrorBody]
	}
	return text
}

// extractMessageText reads a completion's content field, which providers send
// either as a string or as an array of parts carrying text or content. This
// mirrors the previous server's extract_message_text.
func extractMessageText(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return ""
	}
	switch v := value.(type) {
	case string:
		return v
	case []any:
		var builder strings.Builder
		for _, part := range v {
			object, ok := part.(map[string]any)
			if !ok {
				continue
			}
			if text, ok := object["text"].(string); ok {
				builder.WriteString(text)
				continue
			}
			if content, ok := object["content"].(string); ok {
				builder.WriteString(content)
			}
		}
		return builder.String()
	default:
		return ""
	}
}
