package integration

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// embeddingDim matches the dimension the seeded embedding configuration
// declares, so the vector written to memo_embeddings is a real one of the
// expected width.
const embeddingDim = 4

// stubEmbedder satisfies service.EmbeddingClient. It produces a deterministic
// vector derived from the text, so a test can predict which memo is closest to
// a query without contacting a provider.
type stubEmbedder struct {
	mu    sync.Mutex
	calls int
	last  string
	fixed []float32
	err   error
}

func (s *stubEmbedder) Embed(_ context.Context, text string, _ domain.AIConfig) ([]float32, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.calls++
	s.last = text
	if s.err != nil {
		return nil, s.err
	}
	if s.fixed != nil {
		out := make([]float32, len(s.fixed))
		copy(out, s.fixed)
		return out, nil
	}
	return vectorFor(text), nil
}

// setVector makes the stub return a fixed vector until it is replaced.
func (s *stubEmbedder) setVector(vector []float32) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.fixed = vector
	s.err = nil
}

// setError makes the stub fail.
func (s *stubEmbedder) setError(err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.err = err
}

// lastText reports the last text the stub embedded.
func (s *stubEmbedder) lastText() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.last
}

// EmbedQuery satisfies httpapi.QueryEmbedder, which the search endpoint
// declares. It reuses the same deterministic vector as the embedding client.
func (s *stubEmbedder) EmbedQuery(ctx context.Context, text string) ([]float32, error) {
	return s.Embed(ctx, text, domain.AIConfig{Provider: "stub"})
}

// vectorFor derives a unit-ish vector from a string. Text sharing its first
// letter lands closer together, which is enough to assert ranking.
func vectorFor(text string) []float32 {
	values := make([]float32, embeddingDim)
	for i := range values {
		values[i] = 0.1
	}
	if text == "" {
		return values
	}
	bucket := float32(text[0]%7) / 7
	values[0] = 0.9
	values[1] = bucket
	values[2] = 1 - bucket
	values[3] = 0.2
	return values
}

// stubEmbeddingConfigs satisfies service.EmbeddingConfigProvider.
type stubEmbeddingConfigs struct{}

func (stubEmbeddingConfigs) EmbeddingConfig(context.Context) (*domain.ServerAIConfig, error) {
	dim := int32(embeddingDim)
	return &domain.ServerAIConfig{
		Key: domain.AIKeyEmbedding,
		AIConfig: domain.AIConfig{
			Provider: "stub",
			BaseURL:  "http://stub.invalid",
			APIKey:   "key",
			Model:    "stub-embed",
		},
		EmbeddingDim: &dim,
	}, nil
}

// stubChat satisfies service.CompletionClient. Replies are scripted, so a test
// controls exactly what the pipeline persists.
type stubChat struct {
	mu       sync.Mutex
	script   []string
	requests []service.CompletionRequest
	err      error
	block    chan struct{}
}

func (s *stubChat) Complete(
	ctx context.Context,
	req service.CompletionRequest,
) (service.CompletionResult, error) {
	s.mu.Lock()
	s.requests = append(s.requests, req)
	index := len(s.requests) - 1
	block := s.block
	err := s.err
	var reply string
	if index < len(s.script) {
		reply = s.script[index]
	} else if len(s.script) > 0 {
		reply = s.script[len(s.script)-1]
	}
	s.mu.Unlock()

	if block != nil {
		select {
		case <-block:
		case <-ctx.Done():
			return service.CompletionResult{}, ctx.Err()
		}
	}
	if err != nil {
		return service.CompletionResult{}, err
	}
	return service.CompletionResult{Content: reply}, nil
}

// setScript replaces the replies the stub will hand out.
func (s *stubChat) setScript(replies ...string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.script = replies
	s.requests = nil
}

// setError makes every completion fail until it is cleared.
func (s *stubChat) setError(err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.err = err
}

// requestsSnapshot copies the requests the stub has seen.
func (s *stubChat) requestsSnapshot() []service.CompletionRequest {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]service.CompletionRequest, len(s.requests))
	copy(out, s.requests)
	return out
}

// requestCount reports how many completions have been asked for.
func (s *stubChat) requestCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.requests)
}

func (s *stubChat) release() {
	s.mu.Lock()
	block := s.block
	s.mu.Unlock()
	if block != nil {
		close(block)
	}
}

// stubSimpleChat satisfies httpapi.AICompleter, whose method shape differs from
// the service's completion client.
type stubSimpleChat struct{}

func (stubSimpleChat) Complete(
	context.Context, domain.AIConfig, string, string,
) (string, error) {
	return "", errors.New("not used by these tests")
}

// stubChatConfigs satisfies both service.ChatConfigProvider and
// httpapi.AIConfigProvider: the method shapes are identical. A test can toggle
// vision support through it.
type stubChatConfigs struct {
	disabled bool
	vision   bool
}

func (s stubChatConfigs) ChatConfig(context.Context, uuid.UUID) (domain.AIConfig, error) {
	if s.disabled {
		return domain.AIConfig{}, domain.InvalidInput("AI configuration is not set")
	}
	return domain.AIConfig{
		Provider:       "stub",
		BaseURL:        "http://stub.invalid",
		APIKey:         "key",
		Model:          "stub-model",
		SupportsVision: s.vision,
	}, nil
}

// stubGenerationSettings enables both toggles so the pipeline takes its full
// path.
type stubGenerationSettings struct{}

func (stubGenerationSettings) AutoTagEnabled(context.Context) bool     { return true }
func (stubGenerationSettings) AutoSummaryEnabled(context.Context) bool { return true }

// stubImages satisfies service.ImageProvider with no images.
type stubImages struct{}

func (stubImages) MemoImages(context.Context, uuid.UUID, uuid.UUID, int) ([]service.ImageInput, error) {
	return nil, nil
}

func (stubImages) OwnedImages(context.Context, uuid.UUID, []uuid.UUID, int) ([]service.ImageInput, error) {
	return nil, nil
}

// stubClips satisfies service.ClipFetcher.
type stubClips struct{}

func (stubClips) Fetch(context.Context, string) (service.ClipArticle, error) {
	return service.ClipArticle{}, domain.Internal(errors.New("clipping is not used by these tests"))
}

// stubBlobs satisfies service.BlobStore in memory.
type stubBlobs struct {
	mu    sync.Mutex
	store map[string][]byte
}

func (s *stubBlobs) Put(_ context.Context, path string, data []byte, _ string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.store == nil {
		s.store = map[string][]byte{}
	}
	s.store[path] = data
	return path, nil
}

func (s *stubBlobs) Get(_ context.Context, path string) ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, ok := s.store[path]
	if !ok {
		return nil, domain.ResourceNotFound()
	}
	return data, nil
}

func (s *stubBlobs) Delete(_ context.Context, path string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.store, path)
	return nil
}

func (s *stubBlobs) Exists(_ context.Context, path string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, ok := s.store[path]
	return ok
}

func (s *stubBlobs) PresignedGetURL(context.Context, string, time.Duration) (string, error) {
	return "", errors.New("not used")
}

func (s *stubBlobs) PresignedPutURL(context.Context, string, time.Duration) (string, error) {
	return "", errors.New("not used")
}

// stubImages2 and the other media stubs satisfy the derivative interfaces.
type stubImagesDeriver struct{}

func (stubImagesDeriver) CreateThumbnail(data []byte) ([]byte, error) { return data, nil }
func (stubImagesDeriver) CreateOptimized(data []byte) ([]byte, error) { return data, nil }

type stubVideos struct{}

func (stubVideos) CreateThumbnail(_ context.Context, data []byte) ([]byte, error) {
	return data, nil
}
func (stubVideos) CreateOptimized(_ context.Context, data []byte) ([]byte, error) {
	return data, nil
}

type stubAvatars struct{}

func (stubAvatars) SetAvatar(
	_ context.Context, _ uuid.UUID, avatarURL string, _ int64,
) (domain.User, error) {
	return domain.User{AvatarURL: &avatarURL}, nil
}

func (stubAvatars) AvatarBlob(context.Context, uuid.UUID) ([]byte, error) {
	return nil, domain.ResourceNotFound()
}

// stubBackfiller satisfies service.AdminBackfiller.
type stubBackfiller struct{}

func (stubBackfiller) BackfillMissing(context.Context) (int64, int64, int64, error) {
	return 0, 0, 0, nil
}

// parseTagsFromStub reads a JSON array of tag strings, standing in for the
// provider's tag parser so no client package is imported here.
func parseTagsFromStub(raw string) ([]string, error) {
	trimmed := strings.TrimSpace(raw)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	trimmed = strings.TrimSpace(trimmed)

	trimmed = strings.TrimPrefix(trimmed, "[")
	trimmed = strings.TrimSuffix(trimmed, "]")
	if strings.TrimSpace(trimmed) == "" {
		return nil, fmt.Errorf("no tags in %q", raw)
	}

	tags := []string{}
	for _, part := range strings.Split(trimmed, ",") {
		tag := strings.Trim(strings.TrimSpace(part), `"'`)
		if tag != "" {
			tags = append(tags, tag)
		}
	}
	if len(tags) == 0 {
		return nil, fmt.Errorf("no tags in %q", raw)
	}
	return tags, nil
}
