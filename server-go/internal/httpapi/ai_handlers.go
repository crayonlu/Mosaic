package httpapi

import (
	"context"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/aiclient"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/retry"
)

// AIConfigProvider supplies the caller's chat configuration. It is declared
// here, at the consumer, so the AI endpoints can be driven without a database.
type AIConfigProvider interface {
	ChatConfig(ctx context.Context, userID uuid.UUID) (domain.AIConfig, error)
}

// AICompleter performs one chat completion and returns the model's text.
type AICompleter interface {
	Complete(ctx context.Context, config domain.AIConfig, systemPrompt, userMessage string) (string, error)
}

type summarizeRequest struct {
	Content string `json:"content" validate:"required"`
}

type summarizeResponse struct {
	Summary string `json:"summary"`
}

type suggestTagsRequest struct {
	Content      string   `json:"content" validate:"required"`
	ExistingTags []string `json:"existingTags"`
}

type suggestTagsResponse struct {
	Tags []string `json:"tags"`
}

func handleSummarize(configs AIConfigProvider, ai AICompleter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req summarizeRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}

		config, ok := resolveAIConfig(w, r, configs)
		if !ok {
			return
		}

		prompt := "Summarize the following content in 1-2 sentences. " +
			"Be concise and capture the key point. " +
			"Use the same language as the provided content. " +
			"Output only the summary, no extra text.\n\nContent:\n" + req.Content

		reply, err := complete(r.Context(), ai, config, prompt)
		if err != nil {
			writeSimpleError(w, http.StatusInternalServerError, "AI service call failed")
			return
		}

		summary := strings.TrimSpace(reply)
		if summary == "" {
			writeSimpleError(w, http.StatusInternalServerError, "AI returned empty summary")
			return
		}

		WriteJSON(w, http.StatusOK, summarizeResponse{Summary: summary})
	}
}

func handleSuggestTags(configs AIConfigProvider, ai AICompleter, parseTags func(string) ([]string, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req suggestTagsRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}

		config, ok := resolveAIConfig(w, r, configs)
		if !ok {
			return
		}

		existing := "(no existing tags yet)"
		if len(req.ExistingTags) > 0 {
			existing = strings.Join(req.ExistingTags, ", ")
		}

		prompt := "You are a tagging assistant for a personal journal app. " +
			"Generate 1-4 concise tags based on the content below. " +
			"Prefer reusing tags from the existing tag list when they fit. " +
			"Only create new tags when none of the existing ones are appropriate. " +
			"Tags should be short (1-3 words), lowercase. " +
			"Use the same language as the provided content. " +
			"Respond with ONLY a JSON array of tag strings, e.g.: [\"work\", \"health\"]\n\n" +
			"Existing tags: " + existing + "\n\nContent:\n" + req.Content

		reply, err := complete(r.Context(), ai, config, prompt)
		if err != nil {
			writeSimpleError(w, http.StatusInternalServerError, "AI service call failed")
			return
		}

		tags, err := parseTags(reply)
		if err != nil {
			writeSimpleError(w, http.StatusInternalServerError, "AI returned an invalid tag response")
			return
		}

		WriteJSON(w, http.StatusOK, suggestTagsResponse{Tags: tags})
	}
}

// resolveAIConfig loads the caller's provider settings, writing the response
// itself when they are missing or the caller is malformed.
func resolveAIConfig(
	w http.ResponseWriter,
	r *http.Request,
	configs AIConfigProvider,
) (domain.AIConfig, bool) {
	userID, err := callerID(r)
	if err != nil {
		writeError(w, r, err)
		return domain.AIConfig{}, false
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		writeSimpleError(w, http.StatusBadRequest, "Invalid user ID")
		return domain.AIConfig{}, false
	}

	config, err := configs.ChatConfig(r.Context(), userUUID)
	if err != nil {
		writeSimpleError(w, http.StatusBadRequest, "AI service not configured")
		return domain.AIConfig{}, false
	}
	return config, true
}

// complete calls the provider, retrying twice with the previous server's policy.
func complete(
	ctx context.Context,
	ai AICompleter,
	config domain.AIConfig,
	prompt string,
) (string, error) {
	var reply string
	err := retry.Do(ctx, retry.DefaultPolicy(), func(attemptCtx context.Context) error {
		text, err := ai.Complete(attemptCtx, config, aiclient.SystemPrompt, prompt)
		if err != nil {
			return err
		}
		reply = text
		return nil
	})
	if err != nil {
		return "", err
	}
	return reply, nil
}

// writeSimpleError renders the `{"error": "..."}` body these AI endpoints have
// always used. They do not share the standard envelope.
func writeSimpleError(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, map[string]string{"error": message})
}

func registerAIRoutes(
	r chi.Router,
	configs AIConfigProvider,
	ai AICompleter,
	parseTags func(string) ([]string, error),
) {
	serve(r, "/ai/summarize", map[string]http.HandlerFunc{
		http.MethodPost: handleSummarize(configs, ai),
	})
	serve(r, "/ai/suggest-tags", map[string]http.HandlerFunc{
		http.MethodPost: handleSuggestTags(configs, ai, parseTags),
	})
}
