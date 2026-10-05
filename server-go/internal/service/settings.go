package service

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// appTimezoneKey and defaultTimezone mirror the seeded app_settings row and the
// fallback the previous server used.
const (
	appTimezoneKey  = "app_timezone"
	defaultTimezone = "Asia/Shanghai"
	shanghaiOffset  = 8 * 60 * 60
)

// resolveTimezone parses an IANA zone name, falling back to a fixed UTC+8 zone
// when the name is unknown, matching the previous server's tz fallback.
func resolveTimezone(name string) *time.Location {
	if location, err := time.LoadLocation(name); err == nil {
		return location
	}
	return time.FixedZone(defaultTimezone, shanghaiOffset)
}

// AppSettingsStore reads and writes the key/value settings table.
type AppSettingsStore interface {
	ByKey(ctx context.Context, key string) (string, error)
	Set(ctx context.Context, key, value string, now int64) error
}

// AppSettingsService resolves application settings with defaults. Missing keys
// and lookup failures both yield the caller's default, matching the previous
// server, so no method returns an error.
type AppSettingsService struct {
	settings AppSettingsStore
}

func NewAppSettingsService(settings AppSettingsStore) *AppSettingsService {
	return &AppSettingsService{settings: settings}
}

// String returns a setting's value or the default when unset.
func (s *AppSettingsService) String(ctx context.Context, key, fallback string) string {
	value, err := s.settings.ByKey(ctx, key)
	if err != nil {
		return fallback
	}
	return value
}

// Int parses a setting as an integer, using the default on any failure.
func (s *AppSettingsService) Int(ctx context.Context, key string, fallback int32) int32 {
	value, err := s.settings.ByKey(ctx, key)
	if err != nil {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return int32(parsed)
}

// Bool parses a setting as a boolean, using the default unless it is exactly
// "true" or "false".
func (s *AppSettingsService) Bool(ctx context.Context, key string, fallback bool) bool {
	value, err := s.settings.ByKey(ctx, key)
	if err != nil {
		return fallback
	}
	switch value {
	case "true":
		return true
	case "false":
		return false
	default:
		return fallback
	}
}

// Timezone returns the configured application timezone.
func (s *AppSettingsService) Timezone(ctx context.Context) *time.Location {
	return resolveTimezone(s.String(ctx, appTimezoneKey, defaultTimezone))
}

// UserAIConfigStore is the persistence the per-user AI config service needs.
type UserAIConfigStore interface {
	ByUser(ctx context.Context, userID uuid.UUID) (domain.UserAIConfig, error)
	Upsert(ctx context.Context, userID uuid.UUID, config domain.AIConfig, now int64) (domain.UserAIConfig, error)
	Delete(ctx context.Context, userID uuid.UUID) error
}

// UserAIConfigService implements the per-user AI configuration endpoints.
type UserAIConfigService struct {
	configs UserAIConfigStore
}

func NewUserAIConfigService(configs UserAIConfigStore) *UserAIConfigService {
	return &UserAIConfigService{configs: configs}
}

// Get returns a user's configuration, or nil when none is set.
func (s *UserAIConfigService) Get(ctx context.Context, userID string) (*domain.UserAIConfig, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, domain.InvalidUUID(err)
	}

	config, err := s.configs.ByUser(ctx, id)
	if errors.Is(err, domain.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, domain.Internal(err)
	}
	return &config, nil
}

// Upsert stores a user's configuration, replacing any existing one.
func (s *UserAIConfigService) Upsert(
	ctx context.Context,
	userID string,
	config domain.AIConfig,
) (domain.UserAIConfig, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domain.UserAIConfig{}, domain.InvalidUUID(err)
	}

	saved, err := s.configs.Upsert(ctx, id, config, time.Now().Unix())
	if err != nil {
		return domain.UserAIConfig{}, domain.Internal(err)
	}
	return saved, nil
}

// Delete removes a user's configuration.
func (s *UserAIConfigService) Delete(ctx context.Context, userID string) error {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domain.InvalidUUID(err)
	}
	if err := s.configs.Delete(ctx, id); err != nil {
		return domain.Internal(err)
	}
	return nil
}
