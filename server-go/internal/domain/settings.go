package domain

import "github.com/google/uuid"

// AIConfig is the provider settings shared by the server-wide and per-user
// configurations.
type AIConfig struct {
	Provider         string
	BaseURL          string
	APIKey           string
	Model            string
	Temperature      *float64
	MaxTokens        *int32
	TimeoutSeconds   *int32
	SupportsVision   bool
	SupportsThinking bool
}

// ServerAIConfig is a server-wide provider configuration, keyed by capability.
type ServerAIConfig struct {
	Key string
	AIConfig
	EmbeddingDim *int32
	UpdatedAt    int64
}

// UserAIConfig is one user's own provider configuration.
type UserAIConfig struct {
	ID     uuid.UUID
	UserID uuid.UUID
	AIConfig
	CreatedAt int64
	UpdatedAt int64
}

// Config keys used by the server-wide table.
const (
	AIKeyChat      = "bot"
	AIKeyEmbedding = "embedding"
)

// MaskAPIKey renders a stored key for display, revealing only its last four
// characters.
func MaskAPIKey(key string) string {
	if len(key) > 4 {
		return "****" + key[len(key)-4:]
	}
	return "****"
}
