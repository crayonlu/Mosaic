package httpapi

import (
	"context"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/admin"
	"github.com/crayonlu/mosaic/server-go/internal/auth"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
	"github.com/crayonlu/mosaic/server-go/internal/store"
)

// The concrete admin store must satisfy every interface the admin service
// declares; this is what the parent wires together in main.
var (
	_ service.ManagedUserStore   = (*store.AdminStore)(nil)
	_ service.AdminStatsStore    = (*store.AdminStore)(nil)
	_ service.AdminSettingsStore = (*store.AdminStore)(nil)
	_ service.AdminAIConfigStore = (*store.AdminStore)(nil)
)

const adminTestSecret = "admin-test-secret"

// adminTestEnv wires the real AdminService with in-memory collaborators.
type adminTestEnv struct {
	svc        *service.AdminService
	users      *fakeAdminUsers
	settings   *fakeAdminSettings
	ai         *fakeAdminAIConfig
	backfiller *fakeAdminBackfiller
	activity   *admin.ActivityLog
}

func newAdminTestEnv(t *testing.T) *adminTestEnv {
	t.Helper()
	env := &adminTestEnv{
		users:      newFakeAdminUsers(),
		settings:   newFakeAdminSettings(),
		ai:         newFakeAdminAIConfig(),
		backfiller: &fakeAdminBackfiller{indexed: 3, failed: 1, users: 2, done: make(chan struct{})},
		activity:   admin.NewActivityLog(3),
	}
	started := time.Unix(1700000000, 0)
	env.svc = service.NewAdminService(service.AdminDeps{
		Users: env.users,
		Stats: &fakeAdminStats{storageUsed: 2048, dbSize: 4096, counts: admin.Counts{
			MemosTotal: 12, MemosMonth: 3,
			DiariesTotal: 4, DiariesMonth: 1,
			ResourcesTotal: 5, ResourcesSize: 2048,
			BotsTotal: 2, BotsAutoReply: 1, RepliesTotal: 7,
			ActiveDays: 9,
		}},
		Settings:   env.settings,
		AIConfig:   env.ai,
		Backfiller: env.backfiller,
		Activity:   env.activity,
		Config:     service.AdminConfig{Port: 8080, StorageType: "local"},
		StartedAt:  started,
		Version:    "test-version",
	}).WithClock(func() time.Time { return started.Add(26*time.Hour + 30*time.Minute) })
	return env
}

// newAdminTestRouter mounts the admin API behind the real auth middleware.
func newAdminTestRouter(env *adminTestEnv) *chi.Mux {
	router := chi.NewRouter()
	router.Route("/admin/api", func(r chi.Router) {
		r.Use(RequireAuth(adminTestSecret))
		r.Use(RequireAdmin())
		registerAdminAPIRoutes(r, env.svc)
	})
	return router
}

func adminBearerToken(t *testing.T, role string) string {
	t.Helper()
	token, err := auth.Sign(adminTestSecret, uuid.NewString(), role, false, time.Hour)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	return token
}

type fakeAdminUsers struct {
	mu    sync.Mutex
	users map[uuid.UUID]domain.User
	order []uuid.UUID
}

func newFakeAdminUsers() *fakeAdminUsers {
	return &fakeAdminUsers{users: make(map[uuid.UUID]domain.User)}
}

func (f *fakeAdminUsers) ByID(_ context.Context, id uuid.UUID) (domain.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	user, ok := f.users[id]
	if !ok {
		return domain.User{}, domain.ErrNoRows
	}
	return user, nil
}

func (f *fakeAdminUsers) ExistsByUsername(_ context.Context, username string) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, user := range f.users {
		if user.Username == username {
			return true, nil
		}
	}
	return false, nil
}

func (f *fakeAdminUsers) Create(
	_ context.Context,
	username, passwordHash, role string,
	mustChangePassword bool,
	now int64,
) (domain.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	user := domain.User{
		ID:                 uuid.New(),
		Username:           username,
		PasswordHash:       passwordHash,
		Role:               role,
		MustChangePassword: mustChangePassword,
		IsActive:           true,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
	f.users[user.ID] = user
	f.order = append(f.order, user.ID)
	return user, nil
}

func (f *fakeAdminUsers) CountUsers(_ context.Context) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return int64(len(f.users)), nil
}

func (f *fakeAdminUsers) ListUsers(_ context.Context, limit, offset int) ([]domain.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	users := make([]domain.User, 0, limit)
	for i, id := range f.order {
		if i < offset {
			continue
		}
		if len(users) >= limit {
			break
		}
		users = append(users, f.users[id])
	}
	return users, nil
}

func (f *fakeAdminUsers) UpdateManagedUser(
	_ context.Context,
	id uuid.UUID,
	isActive bool,
	role string,
	passwordHash *string,
	mustChangePassword bool,
	now int64,
) (domain.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	user, ok := f.users[id]
	if !ok {
		return domain.User{}, domain.ErrNoRows
	}
	user.IsActive = isActive
	user.Role = role
	user.MustChangePassword = mustChangePassword
	if passwordHash != nil {
		user.PasswordHash = *passwordHash
	}
	user.UpdatedAt = now
	f.users[id] = user
	return user, nil
}

type fakeAdminStats struct {
	storageUsed int64
	dbSize      int64
	counts      admin.Counts
}

func (f *fakeAdminStats) StorageUsed(_ context.Context) (int64, error) { return f.storageUsed, nil }

func (f *fakeAdminStats) DatabaseSize(_ context.Context) (int64, error) { return f.dbSize, nil }

func (f *fakeAdminStats) AdminCounts(
	_ context.Context, _, _ int64, _ string,
) (admin.Counts, error) {
	return f.counts, nil
}

type fakeAdminSettings struct {
	values map[string]string
}

func newFakeAdminSettings() *fakeAdminSettings {
	return &fakeAdminSettings{values: map[string]string{}}
}

func (f *fakeAdminSettings) GetString(_ context.Context, key, fallback string) (string, error) {
	if value, ok := f.values[key]; ok {
		return value, nil
	}
	return fallback, nil
}

func (f *fakeAdminSettings) GetBool(_ context.Context, key string, fallback bool) (bool, error) {
	value, ok := f.values[key]
	if !ok {
		return fallback, nil
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback, nil
	}
	return parsed, nil
}

func (f *fakeAdminSettings) GetInt(_ context.Context, key string, fallback int32) (int32, error) {
	value, ok := f.values[key]
	if !ok {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback, nil
	}
	return int32(parsed), nil
}

func (f *fakeAdminSettings) SetString(_ context.Context, key, value string) error {
	f.values[key] = value
	return nil
}

type fakeAdminAIConfig struct {
	server map[string]domain.ServerAIConfig
	user   map[uuid.UUID]domain.UserAIConfig
}

func newFakeAdminAIConfig() *fakeAdminAIConfig {
	return &fakeAdminAIConfig{
		server: make(map[string]domain.ServerAIConfig),
		user:   make(map[uuid.UUID]domain.UserAIConfig),
	}
}

func (f *fakeAdminAIConfig) ServerAIConfig(_ context.Context, key string) (domain.ServerAIConfig, error) {
	config, ok := f.server[key]
	if !ok {
		return domain.ServerAIConfig{}, domain.ErrNoRows
	}
	return config, nil
}

func (f *fakeAdminAIConfig) UpsertServerAIConfig(
	_ context.Context, key string, cfg domain.AIConfig, embeddingDim *int32, now int64,
) (domain.ServerAIConfig, error) {
	config := domain.ServerAIConfig{
		Key: key, AIConfig: cfg, EmbeddingDim: embeddingDim, UpdatedAt: now,
	}
	f.server[key] = config
	return config, nil
}

func (f *fakeAdminAIConfig) UserAIConfig(_ context.Context, userID uuid.UUID) (domain.UserAIConfig, error) {
	config, ok := f.user[userID]
	if !ok {
		return domain.UserAIConfig{}, domain.ErrNoRows
	}
	return config, nil
}

func (f *fakeAdminAIConfig) UpsertUserAIConfig(
	_ context.Context, userID uuid.UUID, cfg domain.AIConfig, now int64,
) (domain.UserAIConfig, error) {
	config := domain.UserAIConfig{
		ID: uuid.New(), UserID: userID, AIConfig: cfg, CreatedAt: now, UpdatedAt: now,
	}
	f.user[userID] = config
	return config, nil
}

type fakeAdminBackfiller struct {
	indexed, failed, users int64
	err                    error
	done                   chan struct{}
}

func (f *fakeAdminBackfiller) BackfillMissing(
	_ context.Context,
) (int64, int64, int64, error) {
	if f.done != nil {
		defer close(f.done)
	}
	return f.indexed, f.failed, f.users, f.err
}
