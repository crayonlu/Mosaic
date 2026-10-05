package service

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// defaultEmbeddingDim is the vector width assumed when no provider answers.
const defaultEmbeddingDim = 1536

// EmbeddingStore is the persistence the embedding refresher needs. MemoVersion
// reports the compare-and-swap guard: the revision and update time the caller's
// vector was generated from.
type EmbeddingStore interface {
	MemoVersion(ctx context.Context, memoID uuid.UUID) (revision int32, updatedAt int64, found bool, err error)
	UpsertEmbedding(
		ctx context.Context,
		memoID uuid.UUID,
		sourceText, provider, model string,
		embedding []float32,
		now int64,
	) error
}

// EmbeddingClient performs the provider call that turns text into a vector.
type EmbeddingClient interface {
	Embed(ctx context.Context, text string, config domain.AIConfig) ([]float32, error)
}

// EmbeddingConfigProvider resolves the server-wide embedding configuration.
type EmbeddingConfigProvider interface {
	EmbeddingConfig(ctx context.Context) (*domain.ServerAIConfig, error)
}

// MemoryEmbeddingService keeps memo_embeddings in step with memo content. The
// vector is generated outside the compare-and-swap so a slow provider call can
// never overwrite a newer revision.
type MemoryEmbeddingService struct {
	store   EmbeddingStore
	client  EmbeddingClient
	configs EmbeddingConfigProvider
	now     func() int64
}

func NewMemoryEmbeddingService(
	store EmbeddingStore,
	client EmbeddingClient,
	configs EmbeddingConfigProvider,
) *MemoryEmbeddingService {
	return &MemoryEmbeddingService{
		store:   store,
		client:  client,
		configs: configs,
		now:     func() int64 { return time.Now().UnixMilli() },
	}
}

func (s *MemoryEmbeddingService) WithClock(now func() int64) *MemoryEmbeddingService {
	s.now = now
	return s
}

// BuildEmbeddingSourceText renders the text an embedding is generated from.
// When a revision context is available its first 2000 characters replace the
// memo body so historical content stays discoverable after an edit.
func BuildEmbeddingSourceText(memo domain.Memo, revisionContext string) string {
	tagsText := strings.Join(memo.Tags, ", ")
	summary := ""
	if memo.AiSummary != nil {
		summary = *memo.AiSummary
	}

	contentPart := truncateRunes(memo.Content, 500)
	if strings.TrimSpace(revisionContext) != "" {
		contentPart = truncateRunes(revisionContext, 2000)
	}

	return fmt.Sprintf(
		"A personal diary entry for retrieving relevant historical context.\nsummary: %s\ncontent: %s\ntags: %s",
		summary, contentPart, tagsText)
}

// EmbedQuery embeds a free-text search query with the server-wide embedding
// configuration. It is the boundary the search endpoint declares, so the
// handler never reaches for a provider itself.
func (s *MemoryEmbeddingService) EmbedQuery(ctx context.Context, text string) ([]float32, error) {
	config, err := s.embeddingConfig(ctx)
	if err != nil {
		return nil, err
	}
	return s.GenerateEmbedding(ctx, text, config)
}

// RefreshForMemo regenerates and stores a memo's embedding.
func (s *MemoryEmbeddingService) RefreshForMemo(
	ctx context.Context,
	memo domain.Memo,
	revisionContext string,
) error {
	config, err := s.embeddingConfig(ctx)
	if err != nil {
		return err
	}

	sourceText := BuildEmbeddingSourceText(memo, revisionContext)
	embedding, err := s.GenerateEmbedding(ctx, sourceText, config)
	if err != nil {
		return err
	}

	revision, updatedAt, found, err := s.store.MemoVersion(ctx, memo.ID)
	if err != nil {
		return domain.Internal(err)
	}
	if !found || revision != memo.RevisionCount || updatedAt != memo.UpdatedAt {
		slog.InfoContext(ctx, "discarding stale embedding",
			"memoId", memo.ID, "revision", memo.RevisionCount)
		return nil
	}

	provider, model := "local", "fallback"
	if config != nil {
		provider, model = config.Provider, config.Model
	}
	if err := s.store.UpsertEmbedding(
		ctx, memo.ID, sourceText, provider, model, embedding, s.now(),
	); err != nil {
		return domain.Internal(err)
	}
	return nil
}

// GenerateEmbedding asks the provider for a vector, falling back to a zero
// vector when no usable configuration exists.
func (s *MemoryEmbeddingService) GenerateEmbedding(
	ctx context.Context,
	text string,
	config *domain.ServerAIConfig,
) ([]float32, error) {
	if config == nil {
		return zeroVector(defaultEmbeddingDim), nil
	}
	if strings.TrimSpace(config.APIKey) == "" ||
		strings.TrimSpace(config.Model) == "" ||
		strings.TrimSpace(config.BaseURL) == "" {
		return zeroVector(embeddingDimOf(config)), nil
	}

	embedding, err := s.client.Embed(ctx, text, config.AIConfig)
	if err != nil {
		return nil, domain.Internal(err)
	}
	if config.EmbeddingDim != nil && int(*config.EmbeddingDim) != len(embedding) {
		return nil, domain.Internal(fmt.Errorf(
			"embedding dimension mismatch: model returned %d, but stored config expects %d",
			len(embedding), *config.EmbeddingDim))
	}
	return embedding, nil
}

func (s *MemoryEmbeddingService) embeddingConfig(ctx context.Context) (*domain.ServerAIConfig, error) {
	config, err := s.configs.EmbeddingConfig(ctx)
	if err != nil {
		return nil, domain.Internal(err)
	}
	return config, nil
}

func embeddingDimOf(config *domain.ServerAIConfig) int {
	if config != nil && config.EmbeddingDim != nil && *config.EmbeddingDim > 0 {
		return int(*config.EmbeddingDim)
	}
	return defaultEmbeddingDim
}

func zeroVector(dim int) []float32 {
	if dim <= 0 {
		dim = defaultEmbeddingDim
	}
	return make([]float32, dim)
}
