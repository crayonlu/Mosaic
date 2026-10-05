package service

import (
	"context"
	"strings"
	"time"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/retry"
)

// generationImageLimit matches the previous server's cap on the memo images
// attached to a generation prompt.
const generationImageLimit = 4

// BuildAutoTagPrompt reproduces the previous server's auto-tag prompt.
func BuildAutoTagPrompt(existingTags []string, revisionContext string) string {
	hint := "(no existing tags yet)"
	if len(existingTags) > 0 {
		hint = strings.Join(existingTags, ", ")
	}

	return "You are a tagging assistant for a personal journal app. " +
		"Generate 1-4 concise tags based on the user's complete record history below. " +
		"Focus on what is currently most relevant. " +
		"Prefer reusing tags from the existing tag list when they fit. " +
		"Only create new tags when none of the existing ones are appropriate. " +
		"Tags should be short (1-3 words), lowercase. " +
		"Use the same language as the provided content. " +
		"Respond with ONLY a JSON array of tag strings, e.g.: [\"work\", \"health\"]\n\n" +
		"Existing tags: " + hint + "\n\nMemo:\n" + revisionContext
}

// BuildAutoSummaryPrompt reproduces the previous server's auto-summary prompt.
func BuildAutoSummaryPrompt(revisionContext string) string {
	return "Summarize the following memo based on its complete record history in 1-2 sentences. " +
		"Focus on the current state. If there are meaningful changes across entries, briefly mention them. " +
		"Be concise and capture the key point. " +
		"Use the same language as the provided content. " +
		"Output only the summary, no extra text.\n\nMemo:\n" + revisionContext
}

// complete performs one completion against the injected client, sending the
// memo images only when the configuration declares vision support.
func (s *MemoGenerationService) complete(
	ctx context.Context,
	config domain.AIConfig,
	prompt string,
	images []ImageInput,
	attemptTimeout time.Duration,
) (string, error) {
	if !config.SupportsVision {
		images = nil
	}

	var reply string
	err := retry.Do(ctx, generationRetryPolicy(attemptTimeout), func(attemptCtx context.Context) error {
		result, err := s.completions.Complete(attemptCtx, CompletionRequest{
			Config:       config,
			SystemPrompt: s.systemPrompt,
			Messages:     []ChatMessage{BuildUserMessage(prompt, images)},
		})
		if err != nil {
			return err
		}
		reply = result.Content
		return nil
	})
	if err != nil {
		return "", err
	}
	return reply, nil
}

// loadMemoImages fetches the images a generation prompt may carry. A failure is
// logged and treated as "no images": it must not stop the generation.
func (s *MemoGenerationService) loadMemoImages(
	ctx context.Context,
	memo domain.Memo,
) []ImageInput {
	if s.images == nil {
		return nil
	}
	images, err := s.images.MemoImages(ctx, memo.UserID, memo.ID, generationImageLimit)
	if err != nil {
		return nil
	}
	return images
}

// normalizeGeneratedText trims a model reply for storage.
func normalizeGeneratedText(value string) string {
	return strings.TrimSpace(value)
}
