package httpapi

import (
	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// Request and response bodies for the per-user AI configuration endpoints.

type upsertAIConfigRequest struct {
	Provider         string   `json:"provider" validate:"required"`
	BaseURL          string   `json:"baseUrl" validate:"required"`
	APIKey           string   `json:"apiKey" validate:"required"`
	Model            string   `json:"model" validate:"required"`
	Temperature      *float64 `json:"temperature"`
	MaxTokens        *int32   `json:"maxTokens"`
	TimeoutSeconds   *int32   `json:"timeoutSeconds"`
	SupportsVision   *bool    `json:"supportsVision"`
	SupportsThinking *bool    `json:"supportsThinking"`
}

// aiConfigResponse never carries the stored API key: only its last four
// characters, prefixed with "****", are returned.
type aiConfigResponse struct {
	Provider         string   `json:"provider"`
	BaseURL          string   `json:"baseUrl"`
	APIKey           string   `json:"apiKey"`
	Model            string   `json:"model"`
	Temperature      *float64 `json:"temperature"`
	MaxTokens        *int32   `json:"maxTokens"`
	TimeoutSeconds   *int32   `json:"timeoutSeconds"`
	SupportsVision   bool     `json:"supportsVision"`
	SupportsThinking bool     `json:"supportsThinking"`
	UpdatedAt        int64    `json:"updatedAt"`
}

func toAIConfigResponse(config domain.UserAIConfig) aiConfigResponse {
	return aiConfigResponse{
		Provider:         config.Provider,
		BaseURL:          config.BaseURL,
		APIKey:           domain.MaskAPIKey(config.APIKey),
		Model:            config.Model,
		Temperature:      config.Temperature,
		MaxTokens:        config.MaxTokens,
		TimeoutSeconds:   config.TimeoutSeconds,
		SupportsVision:   config.SupportsVision,
		SupportsThinking: config.SupportsThinking,
		UpdatedAt:        config.UpdatedAt,
	}
}

func aiBoolOrFalse(value *bool) bool {
	if value == nil {
		return false
	}
	return *value
}
