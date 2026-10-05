package store

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crayonlu/mosaic/server-go/internal/admin"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

const adminServerAIConfigColumns = `key, provider, base_url, api_key, model, temperature,
	max_tokens, timeout_seconds, supports_vision, supports_thinking, embedding_dim, updated_at`

const adminUserAIConfigColumns = `id, user_id, provider, base_url, api_key, model, temperature,
	max_tokens, timeout_seconds, supports_vision, supports_thinking, created_at, updated_at`

// AdminStore backs the administrative dashboard: managed-user persistence, the
// aggregate statistics and health figures, app settings, and AI configuration.
type AdminStore struct {
	pool *pgxpool.Pool
}

func NewAdminStore(pool *pgxpool.Pool) *AdminStore {
	return &AdminStore{pool: pool}
}

// ByID looks up an account by identifier.
func (s *AdminStore) ByID(ctx context.Context, id uuid.UUID) (domain.User, error) {
	return scanUser(s.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users WHERE id = $1`, id))
}

// ExistsByUsername reports whether a username is already taken.
func (s *AdminStore) ExistsByUsername(ctx context.Context, username string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM users WHERE username = $1)`, username).Scan(&exists)
	return exists, err
}

// Create inserts an account and returns the stored row.
func (s *AdminStore) Create(
	ctx context.Context,
	username, passwordHash, role string,
	mustChangePassword bool,
	now int64,
) (domain.User, error) {
	return scanUser(s.pool.QueryRow(ctx,
		`INSERT INTO users (username, password_hash, role, must_change_password, is_active, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, true, $5, $5)
		 RETURNING `+userColumns,
		username, passwordHash, role, mustChangePassword, now))
}

// CountUsers returns the number of accounts.
func (s *AdminStore) CountUsers(ctx context.Context) (int64, error) {
	var total int64
	err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&total)
	return total, err
}

// ListUsers returns one page of accounts, oldest first.
func (s *AdminStore) ListUsers(ctx context.Context, limit, offset int) ([]domain.User, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT `+userColumns+` FROM users ORDER BY created_at ASC LIMIT $1 OFFSET $2`,
		limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]domain.User, 0, limit)
	for rows.Next() {
		user, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, rows.Err()
}

// UpdateManagedUser applies the administrator-controlled fields. A nil hash
// leaves the stored password untouched.
func (s *AdminStore) UpdateManagedUser(
	ctx context.Context,
	id uuid.UUID,
	isActive bool,
	role string,
	passwordHash *string,
	mustChangePassword bool,
	now int64,
) (domain.User, error) {
	return scanUser(s.pool.QueryRow(ctx,
		`UPDATE users
		 SET is_active = $1, role = $2, must_change_password = $3,
		     password_hash = COALESCE($4, password_hash), updated_at = $5
		 WHERE id = $6
		 RETURNING `+userColumns,
		isActive, role, mustChangePassword, passwordHash, now, id))
}

// StorageUsed sums the size of every live resource.
func (s *AdminStore) StorageUsed(ctx context.Context) (int64, error) {
	var used int64
	err := s.pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(file_size), 0)::BIGINT FROM resources WHERE is_deleted = FALSE`).
		Scan(&used)
	return used, err
}

// DatabaseSize reports the current database size in bytes.
func (s *AdminStore) DatabaseSize(ctx context.Context) (int64, error) {
	var size int64
	err := s.pool.QueryRow(ctx,
		`SELECT COALESCE(pg_database_size(current_database()), 0)`).Scan(&size)
	return size, err
}

// AdminCounts gathers the dashboard tallies in one round trip. The window is
// half-open [monthStart, monthEnd); active days are resolved in tz.
func (s *AdminStore) AdminCounts(
	ctx context.Context,
	monthStart, monthEnd int64,
	tz string,
) (admin.Counts, error) {
	const query = `
		SELECT
		  (SELECT COUNT(*) FROM memos WHERE is_deleted = FALSE) AS memos_total,
		  (SELECT COUNT(*) FROM memos WHERE is_deleted = FALSE AND created_at >= $1 AND created_at < $2) AS memos_month,
		  (SELECT COUNT(*) FROM diaries WHERE is_deleted = FALSE) AS diaries_total,
		  (SELECT COUNT(*) FROM diaries WHERE is_deleted = FALSE AND created_at >= $1 AND created_at < $2) AS diaries_month,
		  (SELECT COUNT(*) FROM resources WHERE is_deleted = FALSE) AS resources_total,
		  (SELECT COALESCE(SUM(file_size), 0)::BIGINT FROM resources WHERE is_deleted = FALSE) AS resources_size,
		  (SELECT COUNT(*) FROM bots WHERE is_deleted = FALSE) AS bots_total,
		  (SELECT COUNT(*) FROM bots WHERE is_deleted = FALSE AND auto_reply = TRUE) AS bots_auto,
		  (SELECT COUNT(*) FROM bot_replies) AS replies_total,
		  (SELECT COUNT(DISTINCT (to_timestamp(created_at / 1000) AT TIME ZONE $3)::date)
		     FROM memos WHERE is_deleted = FALSE AND created_at >= $1 AND created_at < $2) AS active_days`

	var c admin.Counts
	err := s.pool.QueryRow(ctx, query, monthStart, monthEnd, tz).Scan(
		&c.MemosTotal,
		&c.MemosMonth,
		&c.DiariesTotal,
		&c.DiariesMonth,
		&c.ResourcesTotal,
		&c.ResourcesSize,
		&c.BotsTotal,
		&c.BotsAutoReply,
		&c.RepliesTotal,
		&c.ActiveDays,
	)
	return c, err
}

// GetString returns an app setting, or fallback when the key is absent.
func (s *AdminStore) GetString(ctx context.Context, key, fallback string) (string, error) {
	var value string
	err := s.pool.QueryRow(ctx, `SELECT value FROM app_settings WHERE key = $1`, key).Scan(&value)
	if errors.Is(err, pgx.ErrNoRows) {
		return fallback, nil
	}
	if err != nil {
		return "", err
	}
	return value, nil
}

// GetBool returns a boolean app setting, or fallback when absent or malformed.
func (s *AdminStore) GetBool(ctx context.Context, key string, fallback bool) (bool, error) {
	value, err := s.GetString(ctx, key, "")
	if err != nil {
		return false, err
	}
	if value == "" {
		return fallback, nil
	}
	if parsed, err := strconv.ParseBool(value); err == nil {
		return parsed, nil
	}
	return fallback, nil
}

// GetInt returns an integer app setting, or fallback when absent or malformed.
func (s *AdminStore) GetInt(ctx context.Context, key string, fallback int32) (int32, error) {
	value, err := s.GetString(ctx, key, "")
	if err != nil {
		return 0, err
	}
	if value == "" {
		return fallback, nil
	}
	if parsed, err := strconv.Atoi(value); err == nil {
		return int32(parsed), nil
	}
	return fallback, nil
}

// SetString upserts an app setting.
func (s *AdminStore) SetString(ctx context.Context, key, value string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, $3)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
		key, value, time.Now().UnixMilli())
	return err
}

// ServerAIConfig loads a server-wide AI configuration by capability key.
func (s *AdminStore) ServerAIConfig(ctx context.Context, key string) (domain.ServerAIConfig, error) {
	return scanAdminServerAIConfig(s.pool.QueryRow(ctx,
		`SELECT `+adminServerAIConfigColumns+` FROM server_ai_configs WHERE key = $1`, key))
}

// UpsertServerAIConfig stores a server-wide AI configuration and returns it.
func (s *AdminStore) UpsertServerAIConfig(
	ctx context.Context,
	key string,
	cfg domain.AIConfig,
	embeddingDim *int32,
	now int64,
) (domain.ServerAIConfig, error) {
	return scanAdminServerAIConfig(s.pool.QueryRow(ctx,
		`INSERT INTO server_ai_configs
		   (key, provider, base_url, api_key, model, temperature, max_tokens,
		    timeout_seconds, supports_vision, supports_thinking, embedding_dim, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		 ON CONFLICT (key) DO UPDATE SET
		   provider = EXCLUDED.provider, base_url = EXCLUDED.base_url,
		   api_key = EXCLUDED.api_key, model = EXCLUDED.model,
		   temperature = EXCLUDED.temperature, max_tokens = EXCLUDED.max_tokens,
		   timeout_seconds = EXCLUDED.timeout_seconds,
		   supports_vision = EXCLUDED.supports_vision,
		   supports_thinking = EXCLUDED.supports_thinking,
		   embedding_dim = EXCLUDED.embedding_dim, updated_at = EXCLUDED.updated_at
		 RETURNING `+adminServerAIConfigColumns,
		key, cfg.Provider, cfg.BaseURL, cfg.APIKey, cfg.Model, cfg.Temperature,
		cfg.MaxTokens, cfg.TimeoutSeconds, cfg.SupportsVision, cfg.SupportsThinking,
		embeddingDim, now))
}

// UserAIConfig loads one user's AI configuration.
func (s *AdminStore) UserAIConfig(ctx context.Context, userID uuid.UUID) (domain.UserAIConfig, error) {
	return scanAdminUserAIConfig(s.pool.QueryRow(ctx,
		`SELECT `+adminUserAIConfigColumns+` FROM user_ai_configs WHERE user_id = $1`, userID))
}

// UpsertUserAIConfig stores one user's AI configuration and returns it.
func (s *AdminStore) UpsertUserAIConfig(
	ctx context.Context,
	userID uuid.UUID,
	cfg domain.AIConfig,
	now int64,
) (domain.UserAIConfig, error) {
	return scanAdminUserAIConfig(s.pool.QueryRow(ctx,
		`INSERT INTO user_ai_configs
		   (user_id, provider, base_url, api_key, model, temperature, max_tokens,
		    timeout_seconds, supports_vision, supports_thinking, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
		 ON CONFLICT (user_id) DO UPDATE SET
		   provider = EXCLUDED.provider, base_url = EXCLUDED.base_url,
		   api_key = EXCLUDED.api_key, model = EXCLUDED.model,
		   temperature = EXCLUDED.temperature, max_tokens = EXCLUDED.max_tokens,
		   timeout_seconds = EXCLUDED.timeout_seconds,
		   supports_vision = EXCLUDED.supports_vision,
		   supports_thinking = EXCLUDED.supports_thinking,
		   updated_at = EXCLUDED.updated_at
		 RETURNING `+adminUserAIConfigColumns,
		userID, cfg.Provider, cfg.BaseURL, cfg.APIKey, cfg.Model, cfg.Temperature,
		cfg.MaxTokens, cfg.TimeoutSeconds, cfg.SupportsVision, cfg.SupportsThinking, now))
}

func scanAdminServerAIConfig(row pgx.Row) (domain.ServerAIConfig, error) {
	var c domain.ServerAIConfig
	err := row.Scan(
		&c.Key, &c.Provider, &c.BaseURL, &c.APIKey, &c.Model, &c.Temperature,
		&c.MaxTokens, &c.TimeoutSeconds, &c.SupportsVision, &c.SupportsThinking,
		&c.EmbeddingDim, &c.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ServerAIConfig{}, domain.ErrNoRows
	}
	return c, err
}

func scanAdminUserAIConfig(row pgx.Row) (domain.UserAIConfig, error) {
	var c domain.UserAIConfig
	err := row.Scan(
		&c.ID, &c.UserID, &c.Provider, &c.BaseURL, &c.APIKey, &c.Model, &c.Temperature,
		&c.MaxTokens, &c.TimeoutSeconds, &c.SupportsVision, &c.SupportsThinking,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.UserAIConfig{}, domain.ErrNoRows
	}
	return c, err
}
