package service

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/retry"
)

// imageDescriptionPrompt is the instruction the previous server sends with an
// uploaded image.
const imageDescriptionPrompt = "Describe this image in 1-2 sentences. " +
	"Focus on visible content and its likely context for a personal journal. " +
	"Be concise and objective."

// describeImage generates an AI description for an uploaded image and stores
// it. It is best-effort: the work happens off the request path, and every
// failure is logged rather than surfaced, because a description is an
// enrichment rather than part of the upload's contract.
func (s *ResourceService) describeImage(
	ctx context.Context,
	userID, resourceID uuid.UUID,
	storagePath, mimeType string,
) {
	config, err := s.configs.ChatConfig(ctx, userID)
	if err != nil {
		slog.WarnContext(ctx, "skipping the image description: no usable AI configuration",
			"resourceId", resourceID, "err", err)
		return
	}

	// A provider that cannot see images must not be asked to describe one.
	if !config.SupportsVision {
		return
	}

	data, err := s.blobs.Get(ctx, storagePath)
	if err != nil {
		slog.WarnContext(ctx, "reading the image for a description",
			"resourceId", resourceID, "err", err)
		return
	}

	description, err := s.generateImageDescription(ctx, config, mimeType, data)
	if err != nil {
		slog.WarnContext(ctx, "generating the image description",
			"resourceId", resourceID, "err", err)
		return
	}

	applied, err := s.store.SetAIDescription(ctx, resourceID, userID, description, time.Now().UnixMilli())
	if err != nil {
		slog.WarnContext(ctx, "persisting the image description",
			"resourceId", resourceID, "err", err)
		return
	}
	if !applied {
		// The IS NULL guard rejected the write: something already described it.
		slog.InfoContext(ctx, "an image description already existed",
			"resourceId", resourceID)
	}
}

// generateImageDescription asks the provider to describe the image, retrying
// with the previous server's policy. An empty reply counts as a failure so a
// blank description is never stored.
func (s *ResourceService) generateImageDescription(
	ctx context.Context,
	config domain.AIConfig,
	mimeType string,
	data []byte,
) (string, error) {
	var description string

	err := retry.Do(ctx, generationRetryPolicy(60*time.Second), func(attemptCtx context.Context) error {
		result, err := s.completions.Complete(attemptCtx, CompletionRequest{
			Config: config,
			// The previous server sends this call with no system prompt.
			SystemPrompt: "",
			Messages: []ChatMessage{BuildUserMessage(
				imageDescriptionPrompt,
				[]ImageInput{{MimeType: mimeType, Data: data}},
			)},
		})
		if err != nil {
			return err
		}

		trimmed := strings.TrimSpace(result.Content)
		if trimmed == "" {
			return domain.Internal(fmt.Errorf("the model returned an empty image description"))
		}
		description = trimmed
		return nil
	})
	if err != nil {
		return "", err
	}
	return description, nil
}
