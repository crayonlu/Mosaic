package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// clipCompletion returns a delimited reply and records what it was asked.
type clipCompletion struct {
	reply    string
	requests []service.CompletionRequest
}

func (c *clipCompletion) Complete(
	_ context.Context,
	req service.CompletionRequest,
) (service.CompletionResult, error) {
	c.requests = append(c.requests, req)
	return service.CompletionResult{Content: c.reply}, nil
}

// firstMessageText renders a request's first message content as text, so a test
// can assert what the model was actually shown.
func firstMessageText(req service.CompletionRequest) string {
	if len(req.Messages) == 0 {
		return ""
	}
	switch content := req.Messages[0].Content.(type) {
	case string:
		return content
	case []any:
		var out strings.Builder
		for _, part := range content {
			if block, ok := part.(map[string]any); ok {
				if text, ok := block["text"].(string); ok {
					out.WriteString(text)
				}
			}
		}
		return out.String()
	default:
		return ""
	}
}

func TestClipFetchesThroughHTML2LLM(t *testing.T) {
	queries := make(chan string, 2)
	page := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		queries <- r.URL.RawQuery
		_, _ = w.Write([]byte(`(html (head (title "Clipped Page")) (body "hello")))`))
	}))
	defer page.Close()

	store := newFakeMemoStore()
	completion := &clipCompletion{reply: `[TITLE]
A Refined Title
[/TITLE]

[SUMMARY]
One sentence.
[/SUMMARY]

[CONTENT]
The refined body.
[/CONTENT]

[TAGS]
alpha, beta，gamma
[/TAGS]`}

	svc := service.NewMemoService(store, store, NewHTMLClipFetcher(page.Client(), page.URL), time.UTC,
		service.NoPipeline{}, fakeChatConfigs{}, completion, fakeBotImages{})
	router, userID := newMemoRouter(t, svc)
	token := memoToken(t, userID)

	rec := postJSON(t, router, "/memos/clip",
		`{"clipType":"url","url":"https://example.com/article"}`, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("clip status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}

	var result clipResultResponse
	decodeBody(t, rec, &result)

	// The response carries the MODEL's output, not the raw page.
	if result.Title != "A Refined Title" {
		t.Errorf("title = %q, want the model's title", result.Title)
	}
	if result.AiSummary != "One sentence." {
		t.Errorf("summary = %q, want the model's summary", result.AiSummary)
	}
	if result.Content != "The refined body." {
		t.Errorf("content = %q, want the model's body", result.Content)
	}
	if len(result.Tags) != 3 || result.Tags[0] != "alpha" || result.Tags[2] != "gamma" {
		t.Errorf("tags = %v, want the three the model listed", result.Tags)
	}

	// The source fields still describe the fetch.
	if result.SourceType != "url" || result.SourceURL == nil || *result.SourceURL != "https://example.com/article" {
		t.Errorf("source fields wrong: %+v", result)
	}
	if result.OriginalTitle == nil || *result.OriginalTitle != "Clipped Page" {
		t.Errorf("originalTitle = %v, want the fetched page's title", result.OriginalTitle)
	}

	// The fetched page reached the model, and the fetch asked for headless mode.
	if len(completion.requests) != 1 {
		t.Fatalf("the model was called %d times, want 1", len(completion.requests))
	}
	shown := firstMessageText(completion.requests[0])
	if !strings.Contains(shown, "hello") {
		t.Errorf("the model was not shown the fetched page: %q", shown)
	}
	if !strings.Contains(shown, "Clipped Page") {
		t.Errorf("the model was not shown the page title: %q", shown)
	}
	if !strings.Contains(completion.requests[0].SystemPrompt, "[TITLE]") {
		t.Errorf("the system prompt is missing the output format: %q", completion.requests[0].SystemPrompt)
	}

	if query := <-queries; !strings.Contains(query, "headless") {
		t.Errorf("html2llm query = %q, want it to request headless mode", query)
	}
}

func TestClipAppendsHeadlessWithoutClobberingTargetQuery(t *testing.T) {
	queries := make(chan string, 1)
	page := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		queries <- r.URL.RawQuery
		_, _ = w.Write([]byte(`(title "With Query")`))
	}))
	defer page.Close()

	store := newFakeMemoStore()
	svc := service.NewMemoService(store, store, NewHTMLClipFetcher(page.Client(), page.URL), time.UTC, service.NoPipeline{}, fakeChatConfigs{}, fakeCompletion{}, fakeBotImages{})
	router, userID := newMemoRouter(t, svc)
	token := memoToken(t, userID)

	rec := postJSON(t, router, "/memos/clip",
		`{"clipType":"url","url":"https://example.com/a?b=1"}`, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("clip status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}

	raw := <-queries
	if raw != "b=1&headless" {
		t.Errorf("query = %q, want %q", raw, "b=1&headless")
	}
}

func TestClipRejectsMissingType(t *testing.T) {
	store := newFakeMemoStore()
	router, userID := newMemoRouter(t, newMemoService(store, stubClips{}))
	token := memoToken(t, userID)

	rec := postJSON(t, router, "/memos/clip", `{"url":"https://example.com"}`, token)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("clip without clipType = %d, want 400 (body %s)", rec.Code, rec.Body)
	}
}

// TestMemoRoutesAreRegistered guards the full route table against accidental
// removal by probing each method. A missing route would answer 405/404 rather
// than reaching the handler.
func TestMemoRoutesAreRegistered(t *testing.T) {
	store := newFakeMemoStore()
	router, userID := newMemoRouter(t, newMemoService(store, stubClips{}))
	token := memoToken(t, userID)
	id := createOneMemo(t, router, token)

	cases := []struct {
		method string
		path   string
		body   string
	}{
		{http.MethodPost, "/memos", `{"content":"x"}`},
		{http.MethodGet, "/memos", ""},
		{http.MethodGet, "/memos/tags", ""},
		{http.MethodGet, "/memos/search?query=x", ""},
		{http.MethodGet, "/memos/date/2026-02-24", ""},
		{http.MethodGet, "/memos/" + id, ""},
		{http.MethodPut, "/memos/" + id, `{"content":"y"}`},
		{http.MethodGet, "/memos/" + id + "/detail", ""},
		{http.MethodGet, "/memos/" + id + "/revisions", ""},
		{http.MethodPut, "/memos/" + id + "/archive", "{}"},
		{http.MethodPut, "/memos/" + id + "/unarchive", ""},
		{http.MethodDelete, "/memos/" + id, ""},
	}

	for _, tc := range cases {
		rec := doJSON(t, router, tc.method, tc.path, tc.body, token)
		if rec.Code == http.StatusMethodNotAllowed || rec.Code == http.StatusNotFound {
			t.Errorf("%s %s = %d, route not registered", tc.method, tc.path, rec.Code)
		}
	}
}

func createOneMemo(t *testing.T, router http.Handler, token string) string {
	t.Helper()
	rec := postJSON(t, router, "/memos", `{"content":"route probe"}`, token)
	var memo memoResponse
	decodeBody(t, rec, &memo)
	if memo.ID == "" {
		t.Fatal("memo was not created")
	}
	return memo.ID
}
