package service

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

type settingsFakeStore struct {
	values map[string]string
	err    error
}

func newSettingsFakeStore(values map[string]string) *settingsFakeStore {
	if values == nil {
		values = map[string]string{}
	}
	return &settingsFakeStore{values: values}
}

func (f *settingsFakeStore) ByKey(_ context.Context, key string) (string, error) {
	if f.err != nil {
		return "", f.err
	}
	value, ok := f.values[key]
	if !ok {
		return "", domain.ErrNoRows
	}
	return value, nil
}

func (f *settingsFakeStore) Set(_ context.Context, key, value string, _ int64) error {
	f.values[key] = value
	return nil
}

func TestAppSettingsDefaultsAndValues(t *testing.T) {
	empty := NewAppSettingsService(newSettingsFakeStore(nil))
	if got := empty.String(context.Background(), "missing", "fallback"); got != "fallback" {
		t.Errorf("String default = %q, want fallback", got)
	}
	if got := empty.Int(context.Background(), "missing", 7); got != 7 {
		t.Errorf("Int default = %d, want 7", got)
	}
	if got := empty.Bool(context.Background(), "missing", true); !got {
		t.Error("Bool default = false, want true")
	}

	service := NewAppSettingsService(newSettingsFakeStore(map[string]string{
		"text":    "value",
		"num":     "42",
		"bad_num": "forty-two",
		"yes":     "true",
		"no":      "false",
		"maybe":   "maybe",
	}))
	ctx := context.Background()

	if got := service.String(ctx, "text", ""); got != "value" {
		t.Errorf("String = %q, want value", got)
	}
	if got := service.Int(ctx, "num", 0); got != 42 {
		t.Errorf("Int = %d, want 42", got)
	}
	if got := service.Int(ctx, "bad_num", 9); got != 9 {
		t.Errorf("Int malformed = %d, want fallback 9", got)
	}
	if !service.Bool(ctx, "yes", false) || service.Bool(ctx, "no", true) {
		t.Error("Bool did not map true/false strings")
	}
	if !service.Bool(ctx, "maybe", true) {
		t.Error("Bool malformed = false, want fallback true")
	}
}

func TestAppSettingsTimezone(t *testing.T) {
	fallback := NewAppSettingsService(newSettingsFakeStore(nil))
	if _, offset := time.Now().In(fallback.Timezone(context.Background())).Zone(); offset != 8*60*60 {
		t.Errorf("default timezone offset = %d, want 28800", offset)
	}

	configured := NewAppSettingsService(newSettingsFakeStore(map[string]string{"app_timezone": "UTC"}))
	if _, offset := time.Now().In(configured.Timezone(context.Background())).Zone(); offset != 0 {
		t.Errorf("configured timezone offset = %d, want 0", offset)
	}
}

type aiConfigFakeStore struct {
	configs map[uuid.UUID]domain.UserAIConfig
}

func newAIConfigFakeStore() *aiConfigFakeStore {
	return &aiConfigFakeStore{configs: map[uuid.UUID]domain.UserAIConfig{}}
}

func (f *aiConfigFakeStore) ByUser(_ context.Context, userID uuid.UUID) (domain.UserAIConfig, error) {
	config, ok := f.configs[userID]
	if !ok {
		return domain.UserAIConfig{}, domain.ErrNoRows
	}
	return config, nil
}

func (f *aiConfigFakeStore) Upsert(
	_ context.Context,
	userID uuid.UUID,
	config domain.AIConfig,
	now int64,
) (domain.UserAIConfig, error) {
	stored := domain.UserAIConfig{ID: uuid.New(), UserID: userID, AIConfig: config}
	if existing, ok := f.configs[userID]; ok {
		stored.ID = existing.ID
		stored.CreatedAt = existing.CreatedAt
	} else {
		stored.CreatedAt = now
	}
	stored.UpdatedAt = now
	f.configs[userID] = stored
	return stored, nil
}

func (f *aiConfigFakeStore) Delete(_ context.Context, userID uuid.UUID) error {
	delete(f.configs, userID)
	return nil
}

func TestUserAIConfigGetReturnsNilWhenUnset(t *testing.T) {
	svc := NewUserAIConfigService(newAIConfigFakeStore())

	config, err := svc.Get(context.Background(), uuid.New().String())
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if config != nil {
		t.Errorf("config = %+v, want nil", config)
	}
}

func TestUserAIConfigUpsertAndDelete(t *testing.T) {
	store := newAIConfigFakeStore()
	svc := NewUserAIConfigService(store)
	userID := uuid.New().String()

	saved, err := svc.Upsert(context.Background(), userID, domain.AIConfig{
		Provider: "openai", BaseURL: "https://api.example.com", APIKey: "sk-abcdefgh1234", Model: "gpt",
	})
	if err != nil {
		t.Fatalf("Upsert: %v", err)
	}
	if saved.ID == uuid.Nil || saved.APIKey != "sk-abcdefgh1234" {
		t.Errorf("saved config = %+v, want a stored row with the raw key", saved)
	}

	fetched, err := svc.Get(context.Background(), userID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if fetched == nil || fetched.Model != "gpt" {
		t.Errorf("fetched = %+v, want the stored config", fetched)
	}

	if err := svc.Delete(context.Background(), userID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if after, _ := svc.Get(context.Background(), userID); after != nil {
		t.Errorf("config after delete = %+v, want nil", after)
	}
}
