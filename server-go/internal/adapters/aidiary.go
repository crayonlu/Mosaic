package adapters

import (
	"context"
	"net/http"

	"github.com/crayonlu/mosaic/server-go/internal/aiclient"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// AIDiaryChat performs the completions the auto-diary generator asks for.
type AIDiaryChat struct {
	http *http.Client
}

func NewAIDiaryChat(httpClient *http.Client) *AIDiaryChat {
	return &AIDiaryChat{http: httpClient}
}

func (c *AIDiaryChat) Complete(
	ctx context.Context,
	req service.AIDiaryCompletionRequest,
) (string, error) {
	client, err := aiclient.New(c.http, configFromDomain(req.Config))
	if err != nil {
		return "", err
	}

	messages := make([]aiclient.Message, 0, len(req.Messages))
	for _, message := range req.Messages {
		// BuildUserMessage renders the text-only shape as a plain string and the
		// multimodal shape as text + image parts, exactly as the provider expects.
		rendered := service.BuildUserMessage(message.Content, message.Images)
		messages = append(messages, aiclient.Message{Role: message.Role, Content: rendered.Content})
	}

	reply, err := client.ChatCompletion(ctx, req.SystemPrompt, messages, "")
	if err != nil {
		return "", err
	}
	return reply.Content, nil
}
