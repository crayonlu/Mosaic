package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/auth"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

type stubAIConfigProvider struct {
	config domain.AIConfig
	err    error
}

func (s *stubAIConfigProvider) ChatConfig(context.Context, uuid.UUID) (domain.AIConfig, error) {
	if s.err != nil {
		return domain.AIConfig{}, s.err
	}
	return s.config, nil
}

type stubCompleter struct {
	reply       string
	err         error
	calls       int
	lastSystem  string
	lastUserMsg string
}

func (s *stubCompleter) Complete(
	_ context.Context,
	_ domain.AIConfig,
	systemPrompt, userMessage string,
) (string, error) {
	s.calls++
	s.lastSystem = systemPrompt
	s.lastUserMsg = userMessage
	if s.err != nil {
		return "", s.err
	}
	return s.reply, nil
}

// stubParseTags keeps these tests focused on the handler; the real parser is
// exercised in the aiclient package.
func stubParseTags(value string) ([]string, error) {
	if strings.Contains(value, "not-json") {
		return nil, errors.New("not a tag list")
	}
	return []string{"work", "health"}, nil
}

func newAIRouter(t *testing.T, configs AIConfigProvider, ai AICompleter) (http.Handler, string) {
	t.Helper()

	router := chi.NewRouter()
	router.Group(func(r chi.Router) {
		r.Use(RequireAuth(routerSecret))
		registerAIRoutes(r, configs, ai, stubParseTags)
	})

	token, err := auth.Sign(routerSecret, uuid.New().String(), domain.RoleUser, false, time.Hour)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	return router, token
}

func TestSummarizeReturnsTheModelSummary(t *testing.T) {
	ai := &stubCompleter{reply: "  A short summary.  "}
	router, token := newAIRouter(t, &stubAIConfigProvider{}, ai)

	rec := postJSON(t, router, "/ai/summarize", `{"content":"long text"}`, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}

	var body summarizeResponse
	decodeBody(t, rec, &body)
	if body.Summary != "A short summary." {
		t.Errorf("summary = %q, want the trimmed model reply", body.Summary)
	}
}

func TestSummarizePromptIsBuiltFromTheRequest(t *testing.T) {
	ai := &stubCompleter{reply: "ok"}
	router, token := newAIRouter(t, &stubAIConfigProvider{}, ai)

	postJSON(t, router, "/ai/summarize", `{"content":"my diary entry"}`, token)

	if !strings.Contains(ai.lastUserMsg, "my diary entry") {
		t.Errorf("user message does not carry the content: %q", ai.lastUserMsg)
	}
	if !strings.Contains(ai.lastUserMsg, "Summarize the following content") {
		t.Errorf("user message is missing the summarization instruction: %q", ai.lastUserMsg)
	}
	if !strings.Contains(ai.lastSystem, "SAME LANGUAGE") {
		t.Errorf("system prompt is missing the language rule: %q", ai.lastSystem)
	}
}

func TestSummarizeErrorBodies(t *testing.T) {
	cases := []struct {
		name       string
		configs    AIConfigProvider
		ai         AICompleter
		wantStatus int
		wantError  string
	}{
		{
			name:       "provider not configured",
			configs:    &stubAIConfigProvider{err: errors.New("missing")},
			ai:         &stubCompleter{},
			wantStatus: http.StatusBadRequest,
			wantError:  "AI service not configured",
		},
		{
			name:       "provider call failed",
			configs:    &stubAIConfigProvider{},
			ai:         &stubCompleter{err: errors.New("upstream 502")},
			wantStatus: http.StatusInternalServerError,
			wantError:  "AI service call failed",
		},
		{
			name:       "empty reply",
			configs:    &stubAIConfigProvider{},
			ai:         &stubCompleter{reply: "   "},
			wantStatus: http.StatusInternalServerError,
			wantError:  "AI returned empty summary",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			router, token := newAIRouter(t, tc.configs, tc.ai)

			rec := postJSON(t, router, "/ai/summarize", `{"content":"text"}`, token)
			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d (body %s)", rec.Code, tc.wantStatus, rec.Body)
			}

			// These endpoints use the bare {"error": "..."} body, not the
			// standard envelope, and that has always been the case.
			var body map[string]string
			decodeBody(t, rec, &body)
			if body["error"] != tc.wantError {
				t.Errorf("error = %q, want %q", body["error"], tc.wantError)
			}
			if _, ok := body["message"]; ok {
				t.Error("AI error bodies must not carry a message field")
			}
		})
	}
}

func TestSuggestTagsReturnsParsedTags(t *testing.T) {
	ai := &stubCompleter{reply: `["work","health"]`}
	router, token := newAIRouter(t, &stubAIConfigProvider{}, ai)

	rec := postJSON(t, router, "/ai/suggest-tags",
		`{"content":"went for a run","existingTags":["work","fitness"]}`, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}

	var body suggestTagsResponse
	decodeBody(t, rec, &body)
	if len(body.Tags) != 2 || body.Tags[0] != "work" {
		t.Errorf("tags = %v, want [work health]", body.Tags)
	}
}

func TestSuggestTagsPromptIncludesExistingTags(t *testing.T) {
	ai := &stubCompleter{reply: `["a"]`}
	router, token := newAIRouter(t, &stubAIConfigProvider{}, ai)

	postJSON(t, router, "/ai/suggest-tags",
		`{"content":"body text","existingTags":["alpha","beta"]}`, token)

	if !strings.Contains(ai.lastUserMsg, "alpha, beta") {
		t.Errorf("existing tags were not joined into the prompt: %q", ai.lastUserMsg)
	}

	ai.lastUserMsg = ""
	postJSON(t, router, "/ai/suggest-tags", `{"content":"body text"}`, token)
	if !strings.Contains(ai.lastUserMsg, "(no existing tags yet)") {
		t.Errorf("missing-tags placeholder absent: %q", ai.lastUserMsg)
	}
}

func TestSuggestTagsRejectsAnUnparseableReply(t *testing.T) {
	ai := &stubCompleter{reply: "not-json"}
	router, token := newAIRouter(t, &stubAIConfigProvider{}, ai)

	rec := postJSON(t, router, "/ai/suggest-tags", `{"content":"text"}`, token)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}

	var body map[string]string
	decodeBody(t, rec, &body)
	if body["error"] != "AI returned an invalid tag response" {
		t.Errorf("error = %q", body["error"])
	}
}

func TestAIRoutesRequireAToken(t *testing.T) {
	router, _ := newAIRouter(t, &stubAIConfigProvider{}, &stubCompleter{})

	for _, path := range []string{"/ai/summarize", "/ai/suggest-tags"} {
		rec := postJSON(t, router, path, `{"content":"x"}`, "")
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s without a token = %d, want 401", path, rec.Code)
		}
	}
}

func TestSummarizeRequiresContent(t *testing.T) {
	router, token := newAIRouter(t, &stubAIConfigProvider{}, &stubCompleter{reply: "x"})

	rec := postJSON(t, router, "/ai/summarize", `{}`, token)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}

	var body errorBody
	decodeBody(t, rec, &body)
	if body.Message != "Invalid input: content is required" {
		t.Errorf("message = %q", body.Message)
	}
}

func TestAIErrorBodyShapeIsNotTheStandardEnvelope(t *testing.T) {
	router, token := newAIRouter(t, &stubAIConfigProvider{err: errors.New("missing")}, &stubCompleter{})

	rec := postJSON(t, router, "/ai/summarize", `{"content":"x"}`, token)

	var raw map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &raw); err != nil {
		t.Fatalf("decoding body: %v", err)
	}
	if len(raw) != 1 {
		t.Errorf("AI error body has %d fields, want 1: %v", len(raw), raw)
	}
}
