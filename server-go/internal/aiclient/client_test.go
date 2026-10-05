package aiclient

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// Every test drives the client against an httptest server; nothing here ever
// reaches a real provider. newClient wires the httptest server's URL as the base
// URL and its client as the injected transport.
func newClient(t *testing.T, handler http.HandlerFunc, cfg Config) *Client {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	cfg.BaseURL = server.URL
	client, err := New(server.Client(), cfg)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return client
}

func TestChatCompletionSendsRequestAndParsesReply(t *testing.T) {
	var (
		gotPath   string
		gotAuth   string
		gotBody   chatRequestBody
		decodeErr error
	)
	client := newClient(t, func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotAuth = r.Header.Get("Authorization")
		decodeErr = json.NewDecoder(r.Body).Decode(&gotBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"choices":[{"message":{"content":"hi there","reasoning_content":"thought"}}]}`)
	}, Config{
		Provider:    "test",
		APIKey:      "test-key",
		Model:       "gpt-test",
		Temperature: 0.3,
		MaxTokens:   256,
		Timeout:     5 * time.Second,
	})

	reply, err := client.ChatCompletion(context.Background(), "be nice", []Message{
		{Role: "user", Content: "hello"},
	}, "")
	if err != nil {
		t.Fatalf("ChatCompletion: %v", err)
	}
	if decodeErr != nil {
		t.Fatalf("decoding request body: %v", decodeErr)
	}

	if gotPath != "/chat/completions" {
		t.Errorf("path = %q, want /chat/completions", gotPath)
	}
	if gotAuth != "Bearer test-key" {
		t.Errorf("Authorization = %q, want Bearer test-key", gotAuth)
	}
	if gotBody.Model != "gpt-test" {
		t.Errorf("model = %q, want gpt-test", gotBody.Model)
	}
	if gotBody.Temperature != 0.3 {
		t.Errorf("temperature = %v, want 0.3", gotBody.Temperature)
	}
	if gotBody.MaxTokens != 256 {
		t.Errorf("max_tokens = %d, want 256", gotBody.MaxTokens)
	}
	if len(gotBody.Messages) != 2 {
		t.Fatalf("messages length = %d, want 2", len(gotBody.Messages))
	}
	if gotBody.Messages[0].Role != "system" || gotBody.Messages[0].Content != "be nice" {
		t.Errorf("messages[0] = %+v, want system/be nice", gotBody.Messages[0])
	}
	if gotBody.Messages[1].Role != "user" || gotBody.Messages[1].Content != "hello" {
		t.Errorf("messages[1] = %+v, want user/hello", gotBody.Messages[1])
	}

	if reply.Content != "hi there" {
		t.Errorf("reply content = %q, want hi there", reply.Content)
	}
	if reply.ThinkingContent != "thought" {
		t.Errorf("reply thinking = %q, want thought", reply.ThinkingContent)
	}
}

// chatRequestBody decodes the fields the tests assert on. Content is any so both
// string and vision-array shapes decode.
type chatRequestBody struct {
	Model    string `json:"model"`
	Messages []struct {
		Role    string `json:"role"`
		Content any    `json:"content"`
	} `json:"messages"`
	MaxTokens   int     `json:"max_tokens"`
	Temperature float64 `json:"temperature"`
}

func TestChatCompletionNon2xxIsDomainError(t *testing.T) {
	client := newClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = io.WriteString(w, "rate limited")
	}, Config{Provider: "test", APIKey: "k", Model: "m"})

	_, err := client.ChatCompletion(context.Background(), "sys", nil, "")
	var domainErr *domain.Error
	if !errors.As(err, &domainErr) {
		t.Fatalf("error = %v, want *domain.Error", err)
	}
	if domainErr.Kind != domain.KindInternal {
		t.Errorf("kind = %v, want %v", domainErr.Kind, domain.KindInternal)
	}
	if cause := domainErr.Unwrap(); cause == nil || !strings.Contains(cause.Error(), "429") {
		t.Errorf("cause = %v, want it to mention HTTP 429", cause)
	}
}

func TestChatCompletionMissingContentIsDomainError(t *testing.T) {
	client := newClient(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, `{"choices":[]}`)
	}, Config{Provider: "test", APIKey: "k", Model: "m"})

	_, err := client.ChatCompletion(context.Background(), "sys", nil, "")
	var domainErr *domain.Error
	if !errors.As(err, &domainErr) {
		t.Fatalf("error = %v, want *domain.Error", err)
	}
}

func TestEmbeddingSendsRequestAndParsesVector(t *testing.T) {
	var gotBody EmbeddingRequest
	client := newClient(t, func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&gotBody); err != nil {
			t.Errorf("decoding request body: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"data":[{"embedding":[0.25,-1.5,3]}]}`)
	}, Config{Provider: "test", APIKey: "k", Model: "embed-model"})

	vector, err := client.Embedding(context.Background(), "some text")
	if err != nil {
		t.Fatalf("Embedding: %v", err)
	}
	if gotBody.Model != "embed-model" || gotBody.Input != "some text" {
		t.Errorf("embedding body = %+v, want model/input", gotBody)
	}
	want := []float32{0.25, -1.5, 3}
	if len(vector) != len(want) {
		t.Fatalf("vector length = %d, want %d", len(vector), len(want))
	}
	for i := range want {
		if vector[i] != want[i] {
			t.Errorf("vector[%d] = %v, want %v", i, vector[i], want[i])
		}
	}
}

func TestEmbeddingNon2xxIsDomainError(t *testing.T) {
	client := newClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = io.WriteString(w, "boom")
	}, Config{Provider: "test", APIKey: "k", Model: "m"})

	_, err := client.Embedding(context.Background(), "text")
	var domainErr *domain.Error
	if !errors.As(err, &domainErr) {
		t.Fatalf("error = %v, want *domain.Error", err)
	}
	if domainErr.Kind != domain.KindInternal {
		t.Errorf("kind = %v, want %v", domainErr.Kind, domain.KindInternal)
	}
}

func TestNewRejectsIncompleteConfig(t *testing.T) {
	valid := Config{APIKey: "k", Model: "m", BaseURL: "http://example.invalid"}

	if _, err := New(nil, valid); err == nil {
		t.Error("New(nil, ...) succeeded, want an error")
	}
	for name, cfg := range map[string]Config{
		"missing base url": {APIKey: "k", Model: "m"},
		"missing api key":  {BaseURL: "http://example.invalid", Model: "m"},
		"missing model":    {BaseURL: "http://example.invalid", APIKey: "k"},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := New(http.DefaultClient, cfg)
			var domainErr *domain.Error
			if !errors.As(err, &domainErr) {
				t.Fatalf("error = %v, want *domain.Error", err)
			}
			if domainErr.Kind != domain.KindInvalidInput {
				t.Errorf("kind = %v, want %v", domainErr.Kind, domain.KindInvalidInput)
			}
		})
	}
}

func TestNewAppliesDefaults(t *testing.T) {
	client, err := New(http.DefaultClient, Config{
		APIKey: "k", Model: "m", BaseURL: "http://example.invalid/",
	})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if client.cfg.MaxTokens != defaultMaxTokens {
		t.Errorf("MaxTokens = %d, want %d", client.cfg.MaxTokens, defaultMaxTokens)
	}
	if client.cfg.Temperature != defaultTemperature {
		t.Errorf("Temperature = %v, want %v", client.cfg.Temperature, defaultTemperature)
	}
	if client.cfg.Timeout != defaultTimeout {
		t.Errorf("Timeout = %v, want %v", client.cfg.Timeout, defaultTimeout)
	}
}
