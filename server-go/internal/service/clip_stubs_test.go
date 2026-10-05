package service

import (
	"context"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// stubClipConfigs satisfies ChatConfigProvider for the clip tests.
type stubClipConfigs struct {
	err error
}

func (s stubClipConfigs) ChatConfig(context.Context, uuid.UUID) (domain.AIConfig, error) {
	if s.err != nil {
		return domain.AIConfig{}, s.err
	}
	return domain.AIConfig{Provider: "stub", BaseURL: "http://stub.invalid", APIKey: "key", Model: "stub"}, nil
}

// stubClipCompletion records the request it was handed and returns a scripted
// reply.
type stubClipCompletion struct {
	reply    string
	err      error
	requests []CompletionRequest
}

func (s *stubClipCompletion) Complete(
	_ context.Context,
	req CompletionRequest,
) (CompletionResult, error) {
	s.requests = append(s.requests, req)
	if s.err != nil {
		return CompletionResult{}, s.err
	}
	return CompletionResult{Content: s.reply}, nil
}

// stubClipImages satisfies ImageProvider for the clip tests.
type stubClipImages struct {
	images []ImageInput
	err    error
}

func (s stubClipImages) MemoImages(context.Context, uuid.UUID, uuid.UUID, int) ([]ImageInput, error) {
	return s.images, s.err
}

func (s stubClipImages) OwnedImages(context.Context, uuid.UUID, []uuid.UUID, int) ([]ImageInput, error) {
	return s.images, s.err
}
