package adapters

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/aiclient"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// BotCompleter performs the chat completions the bot module asks for, building a
// provider client per call because the model, key and base URL are all
// per-user.
type BotCompleter struct {
	http *http.Client
}

func NewBotCompleter(httpClient *http.Client) *BotCompleter {
	return &BotCompleter{http: httpClient}
}

func (c *BotCompleter) Complete(
	ctx context.Context,
	req service.CompletionRequest,
) (service.CompletionResult, error) {
	client, err := aiclient.New(c.http, configFromDomain(req.Config))
	if err != nil {
		return service.CompletionResult{}, err
	}

	messages := make([]aiclient.Message, 0, len(req.Messages))
	for _, message := range req.Messages {
		messages = append(messages, aiclient.Message{Role: message.Role, Content: message.Content})
	}

	reply, err := client.ChatCompletion(ctx, req.SystemPrompt, messages, req.Model)
	if err != nil {
		return service.CompletionResult{}, err
	}

	result := service.CompletionResult{Content: reply.Content}
	if strings.TrimSpace(reply.ThinkingContent) != "" {
		thinking := reply.ThinkingContent
		result.ThinkingContent = &thinking
	}
	return result, nil
}

// EmbeddingClient turns text into a vector using the caller's embedding config.
type EmbeddingClient struct {
	http *http.Client
}

func NewEmbeddingClient(httpClient *http.Client) *EmbeddingClient {
	return &EmbeddingClient{http: httpClient}
}

func (c *EmbeddingClient) Embed(
	ctx context.Context,
	text string,
	config domain.AIConfig,
) ([]float32, error) {
	client, err := aiclient.New(c.http, configFromDomain(config))
	if err != nil {
		return nil, err
	}
	return client.Embedding(ctx, text)
}

// ServerAIConfigReader reads a server-wide provider configuration by key.
type ServerAIConfigReader interface {
	ServerAIConfig(ctx context.Context, key string) (domain.ServerAIConfig, error)
}

// EmbeddingConfigs resolves the server-wide embedding configuration.
type EmbeddingConfigs struct {
	configs ServerAIConfigReader
}

func NewEmbeddingConfigs(configs ServerAIConfigReader) *EmbeddingConfigs {
	return &EmbeddingConfigs{configs: configs}
}

func (c *EmbeddingConfigs) EmbeddingConfig(
	ctx context.Context,
) (*domain.ServerAIConfig, error) {
	config, err := c.configs.ServerAIConfig(ctx, domain.AIKeyEmbedding)
	if err != nil {
		return nil, err
	}
	return &config, nil
}

// MemoResourceLister lists the files attached to a memo.
type MemoResourceLister interface {
	ResourcesForMemo(ctx context.Context, memoID uuid.UUID) ([]domain.Resource, error)
}

// OwnedResourceReader loads a single resource owned by a user.
type OwnedResourceReader interface {
	ByIDForUser(
		ctx context.Context,
		userID, resourceID uuid.UUID,
		liveOnly bool,
	) (domain.Resource, error)
}

// BotImages supplies the images a reply prompt may carry. Only image resources
// are returned, and the caller's limit is honoured after filtering.
type BotImages struct {
	blobs     service.BlobStore
	memoFiles MemoResourceLister
	owned     OwnedResourceReader
}

func NewBotImages(
	blobs service.BlobStore,
	memoFiles MemoResourceLister,
	owned OwnedResourceReader,
) *BotImages {
	return &BotImages{blobs: blobs, memoFiles: memoFiles, owned: owned}
}

func (b *BotImages) MemoImages(
	ctx context.Context,
	_ uuid.UUID,
	memoID uuid.UUID,
	limit int,
) ([]service.ImageInput, error) {
	resources, err := b.memoFiles.ResourcesForMemo(ctx, memoID)
	if err != nil {
		return nil, err
	}
	return b.load(ctx, resources, limit)
}

func (b *BotImages) OwnedImages(
	ctx context.Context,
	userID uuid.UUID,
	resourceIDs []uuid.UUID,
	limit int,
) ([]service.ImageInput, error) {
	resources := make([]domain.Resource, 0, len(resourceIDs))
	for _, resourceID := range resourceIDs {
		resource, err := b.owned.ByIDForUser(ctx, userID, resourceID, true)
		if err != nil {
			continue
		}
		resources = append(resources, resource)
	}
	return b.load(ctx, resources, limit)
}

// load reads the bytes of the first `limit` image resources.
func (b *BotImages) load(
	ctx context.Context,
	resources []domain.Resource,
	limit int,
) ([]service.ImageInput, error) {
	if limit <= 0 {
		return []service.ImageInput{}, nil
	}

	images := make([]service.ImageInput, 0, limit)
	for _, resource := range resources {
		if len(images) == limit {
			break
		}
		if !strings.HasPrefix(resource.MimeType, "image/") {
			continue
		}

		data, err := b.blobs.Get(ctx, resource.StoragePath)
		if err != nil {
			slog.WarnContext(ctx, "reading image for a prompt",
				"resourceId", resource.ID, "err", err)
			continue
		}
		images = append(images, service.ImageInput{MimeType: resource.MimeType, Data: data})
	}
	return images, nil
}

func configFromDomain(config domain.AIConfig) aiclient.Config {
	return aiclient.Config{
		Provider:    config.Provider,
		BaseURL:     config.BaseURL,
		APIKey:      config.APIKey,
		Model:       config.Model,
		Temperature: derefFloat(config.Temperature),
		MaxTokens:   int(derefInt32(config.MaxTokens)),
		Timeout:     secondsToDuration(config.TimeoutSeconds),
	}
}
