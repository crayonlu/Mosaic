package store

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// AppSettingsStore reads and writes the single-row-per-key settings table.
type AppSettingsStore struct {
	pool *pgxpool.Pool
}

func NewAppSettingsStore(pool *pgxpool.Pool) *AppSettingsStore {
	return &AppSettingsStore{pool: pool}
}

// ByKey returns a setting's raw string value, or domain.ErrNoRows when unset.
func (s *AppSettingsStore) ByKey(ctx context.Context, key string) (string, error) {
	var value string
	err := s.pool.QueryRow(ctx, `SELECT value FROM app_settings WHERE key = $1`, key).Scan(&value)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", domain.ErrNoRows
	}
	if err != nil {
		return "", err
	}
	return value, nil
}

// Set stores a setting, replacing any existing value.
func (s *AppSettingsStore) Set(ctx context.Context, key, value string, now int64) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO app_settings (key, value, updated_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = $3`,
		key, value, now)
	return err
}

const settingsAIConfigColumns = `id, user_id, provider, base_url, api_key, model,
	temperature, max_tokens, timeout_seconds, supports_vision, supports_thinking,
	created_at, updated_at`

// UserAIConfigStore reads and writes per-user provider configurations.
type UserAIConfigStore struct {
	pool *pgxpool.Pool
}

func NewUserAIConfigStore(pool *pgxpool.Pool) *UserAIConfigStore {
	return &UserAIConfigStore{pool: pool}
}

func scanSettingsAIConfig(row pgx.Row) (domain.UserAIConfig, error) {
	var config domain.UserAIConfig
	err := row.Scan(
		&config.ID,
		&config.UserID,
		&config.Provider,
		&config.BaseURL,
		&config.APIKey,
		&config.Model,
		&config.Temperature,
		&config.MaxTokens,
		&config.TimeoutSeconds,
		&config.SupportsVision,
		&config.SupportsThinking,
		&config.CreatedAt,
		&config.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.UserAIConfig{}, domain.ErrNoRows
	}
	if err != nil {
		return domain.UserAIConfig{}, err
	}
	return config, nil
}

// ByUser looks up a user's configuration.
func (s *UserAIConfigStore) ByUser(
	ctx context.Context,
	userID uuid.UUID,
) (domain.UserAIConfig, error) {
	return scanSettingsAIConfig(s.pool.QueryRow(ctx,
		`SELECT `+settingsAIConfigColumns+` FROM user_ai_configs WHERE user_id = $1`, userID))
}

// Upsert inserts or replaces a user's configuration. created_at is preserved on
// an update.
func (s *UserAIConfigStore) Upsert(
	ctx context.Context,
	userID uuid.UUID,
	config domain.AIConfig,
	now int64,
) (domain.UserAIConfig, error) {
	return scanSettingsAIConfig(s.pool.QueryRow(ctx,
		`INSERT INTO user_ai_configs (user_id, provider, base_url, api_key, model,
		     temperature, max_tokens, timeout_seconds, supports_vision, supports_thinking,
		     created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
		 ON CONFLICT (user_id) DO UPDATE SET
		     provider = EXCLUDED.provider,
		     base_url = EXCLUDED.base_url,
		     api_key = EXCLUDED.api_key,
		     model = EXCLUDED.model,
		     temperature = EXCLUDED.temperature,
		     max_tokens = EXCLUDED.max_tokens,
		     timeout_seconds = EXCLUDED.timeout_seconds,
		     supports_vision = EXCLUDED.supports_vision,
		     supports_thinking = EXCLUDED.supports_thinking,
		     updated_at = EXCLUDED.updated_at
		 RETURNING `+settingsAIConfigColumns,
		userID, config.Provider, config.BaseURL, config.APIKey, config.Model,
		config.Temperature, config.MaxTokens, config.TimeoutSeconds,
		config.SupportsVision, config.SupportsThinking, now))
}

// Delete removes a user's configuration. Deleting an absent row is not an error,
// matching the previous server.
func (s *UserAIConfigStore) Delete(ctx context.Context, userID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM user_ai_configs WHERE user_id = $1`, userID)
	return err
}
