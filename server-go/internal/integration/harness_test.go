// Package integration drives the shipped server against a real PostgreSQL with
// pgvector. Every test here skips unless MOSAIC_TEST_DATABASE_URL names a
// reachable database, so the unit suite stays runnable without one. Nothing in
// this package contacts an external provider: the model and embedding
// boundaries are stubbed.
package integration

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crayonlu/mosaic/server-go/internal/admin"
	"github.com/crayonlu/mosaic/server-go/internal/auth"
	"github.com/crayonlu/mosaic/server-go/internal/db"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/httpapi"
	"github.com/crayonlu/mosaic/server-go/internal/service"
	"github.com/crayonlu/mosaic/server-go/internal/store"
)

const (
	migrationsDir = "../../migrations"
	testSecret    = "integration-secret"
	testPassword  = "integration-password"
)

// harness is a fully wired server over a real, isolated database.
type harness struct {
	handler    http.Handler
	pool       *pgxpool.Pool
	userID     uuid.UUID
	token      string
	embedder   *stubEmbedder
	configs    *stubChatConfigs
	chat       *stubChat
	generation *service.MemoGenerationService
	bots       *service.BotService
}

var (
	adminPool *pgxpool.Pool
	dbName    string
	baseURL   string
)

// TestMain provisions one database for the whole package and drops it after.
func TestMain(m *testing.M) {
	raw := os.Getenv("MOSAIC_TEST_DATABASE_URL")
	if raw == "" {
		fmt.Fprintln(os.Stderr, "MOSAIC_TEST_DATABASE_URL is not set; integration tests skipped")
		os.Exit(0)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	dbName = "mosaic_verify_" + strings.ReplaceAll(uuid.NewString(), "-", "")[:12]

	var err error
	if adminPool, err = connectMaintenance(ctx, raw); err != nil {
		fmt.Fprintf(os.Stderr, "connecting to the maintenance database: %v\n", err)
		os.Exit(1)
	}
	if _, err := adminPool.Exec(ctx, `CREATE DATABASE `+dbName); err != nil {
		fmt.Fprintf(os.Stderr, "creating %s: %v\n", dbName, err)
		os.Exit(1)
	}

	baseURL = databaseURL(raw, dbName)

	pool, err := db.Connect(ctx, baseURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "connecting to %s: %v\n", dbName, err)
		os.Exit(1)
	}
	if err := db.Migrate(ctx, pool, migrationsDir); err != nil {
		fmt.Fprintf(os.Stderr, "migrating %s: %v\n", dbName, err)
		os.Exit(1)
	}
	pool.Close()

	code := m.Run()

	_, _ = adminPool.Exec(ctx, `DROP DATABASE IF EXISTS `+dbName+` WITH (FORCE)`)
	adminPool.Close()
	os.Exit(code)
}

// newHarness wires the real services over the real database, with only the
// provider boundaries stubbed.
func newHarness(t *testing.T) *harness {
	t.Helper()

	ctx := context.Background()
	pool, err := db.Connect(ctx, baseURL)
	if err != nil {
		t.Fatalf("connecting: %v", err)
	}
	t.Cleanup(pool.Close)

	embedder := &stubEmbedder{}
	configs := &stubChatConfigs{}
	chat := &stubChat{}

	memoStore := store.NewMemoStore(pool)
	resourceStore := store.NewResourceStore(pool)
	userStore := store.NewUserStore(pool)
	adminStore := store.NewAdminStore(pool)
	memoryStore := store.NewMemoryStore(pool)

	settings := service.NewAppSettingsService(store.NewAppSettingsStore(pool))
	userAIConfigs := service.NewUserAIConfigService(store.NewUserAIConfigStore(pool))

	memoryService := service.NewMemoryService(memoryStore)
	embeddingService := service.NewMemoryEmbeddingService(memoryStore, embedder, stubEmbeddingConfigs{})

	// The stub chat adapter is handed to both the bot service and the pipeline.
	botService := service.NewBotService(
		store.NewBotStore(pool),
		store.NewBotStore(pool),
		memoryService,
		configs,
		chat,
		stubImages{},
		settings,
		admin.NewActivityLog(100),
		store.NewAdvisoryLockStore(pool),
	)

	generation := service.NewMemoGenerationService(service.GenerationDeps{
		Store:        store.NewMemoGenerationStore(pool),
		Embeddings:   embeddingService,
		Bots:         botService,
		Images:       stubImages{},
		Configs:      configs,
		Completions:  chat,
		Settings:     stubGenerationSettings{},
		ParseTags:    parseTagsFromStub,
		SystemPrompt: "integration system prompt",
	})

	memoService := service.NewMemoService(
		memoStore,
		botService,
		stubClips{},
		nil,
		generation,
		configs,
		chat,
		stubImages{},
	).WithTimezoneProvider(settings.Timezone)

	userID := seedUser(t, pool)
	token, err := auth.Sign(testSecret, userID.String(), domain.RoleAdmin, false, time.Hour)
	if err != nil {
		t.Fatalf("signing a token: %v", err)
	}
	seedUserAIConfig(t, pool, userID)

	return &harness{
		handler: httpapi.New(httpapi.Deps{
			Auth:      service.NewAuthService(userStore, testSecret),
			JWTSecret: testSecret,

			Memos:      memoService,
			MemoSearch: service.NewHybridSearchService(store.NewHybridSearchStore(pool), settings.Timezone),
			Embedder:   embedder,
			Diaries:    service.NewDiaryService(store.NewDiaryStore(pool)),
			Resources: service.NewResourceService(resourceStore, &stubBlobs{}, stubImagesDeriver{},
				stubVideos{}, stubAvatars{}, "local", configs, chat),
			Stats:        service.NewStatsService(store.NewStatsStore(pool), settings),
			Sync:         service.NewSyncService(store.NewSyncStore(pool)),
			UserAIConfig: userAIConfigs,
			Admin:        service.NewAdminService(service.AdminDeps{Users: adminStore, Stats: adminStore, Settings: adminStore, AIConfig: adminStore, Backfiller: stubBackfiller{}, Activity: admin.NewActivityLog(100), StartedAt: time.Now()}),
			Bots:         botService,
			Memory:       memoryService,

			AIConfigs: configs,
			AI:        stubSimpleChat{},
			ParseTags: parseTagsFromStub,
		}),
		pool:       pool,
		userID:     userID,
		token:      token,
		embedder:   embedder,
		configs:    configs,
		chat:       chat,
		generation: generation,
		bots:       botService,
	}
}

// do issues an authenticated request through the real handler.
func (h *harness) do(t *testing.T, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()

	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+h.token)

	rec := httptest.NewRecorder()
	h.handler.ServeHTTP(rec, req)
	return rec
}

// newBotService builds a second, independent bot service over the same
// database. Two instances share no process state, so anything they agree on
// must be enforced by the database.
func (h *harness) newBotService() *service.BotService {
	settings := service.NewAppSettingsService(store.NewAppSettingsStore(h.pool))
	return service.NewBotService(
		store.NewBotStore(h.pool),
		store.NewBotStore(h.pool),
		service.NewMemoryService(store.NewMemoryStore(h.pool)),
		h.configs,
		h.chat,
		stubImages{},
		settings,
		admin.NewActivityLog(10),
		store.NewAdvisoryLockStore(h.pool),
	)
}

// waitFor polls until cond holds or the deadline passes.
func waitFor(t *testing.T, what string, cond func() bool) {
	t.Helper()

	deadline := time.Now().Add(15 * time.Second)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(25 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for %s", what)
}

// seedAutoReplyBot inserts a bot that replies to new memos automatically.
func seedAutoReplyBot(t *testing.T, h *harness) uuid.UUID {
	t.Helper()

	var id uuid.UUID
	now := time.Now().UnixMilli()
	if err := h.pool.QueryRow(context.Background(),
		`INSERT INTO bots (user_id, name, description, tags, auto_reply, sort_order, created_at, updated_at)
		 VALUES ($1, 'auto-responder', 'integration bot', '[]'::jsonb, true, 1, $2, $2) RETURNING id`,
		h.userID, now).Scan(&id); err != nil {
		t.Fatalf("seeding an auto-reply bot: %v", err)
	}
	return id
}

func connectMaintenance(ctx context.Context, raw string) (*pgxpool.Pool, error) {
	parsed, err := url.Parse(raw)
	if err != nil {
		return nil, err
	}
	parsed.Path = "/postgres"
	return db.Connect(ctx, parsed.String())
}

func databaseURL(raw, name string) string {
	parsed, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	parsed.Path = "/" + name
	return parsed.String()
}

func seedUser(t *testing.T, pool *pgxpool.Pool) uuid.UUID {
	t.Helper()

	hash, err := auth.HashPassword(testPassword)
	if err != nil {
		t.Fatalf("hashing the test password: %v", err)
	}

	var id uuid.UUID
	now := time.Now().Unix()
	if err := pool.QueryRow(context.Background(),
		`INSERT INTO users (username, password_hash, role, must_change_password, is_active, created_at, updated_at)
		 VALUES ($1, $2, 'admin', false, true, $3, $3) RETURNING id`,
		"integration-"+uuid.NewString()[:8], hash, now).Scan(&id); err != nil {
		t.Fatalf("seeding a user: %v", err)
	}
	return id
}

// seedUserAIConfig gives the user a chat configuration so the pipeline takes
// its model path, and an embedding configuration for the vector leg.
func seedUserAIConfig(t *testing.T, pool *pgxpool.Pool, userID uuid.UUID) {
	t.Helper()

	now := time.Now().Unix()
	if _, err := pool.Exec(context.Background(),
		`INSERT INTO user_ai_configs (user_id, provider, base_url, api_key, model, temperature,
		        max_tokens, timeout_seconds, supports_vision, supports_thinking, created_at, updated_at)
		 VALUES ($1, 'stub', 'http://stub.invalid', 'key', 'stub-model', 0.5, 512, 30, false, false, $2, $2)`,
		userID, now); err != nil {
		t.Fatalf("seeding the user AI config: %v", err)
	}

	if _, err := pool.Exec(context.Background(),
		`INSERT INTO server_ai_configs (key, provider, base_url, api_key, model, temperature,
		        max_tokens, timeout_seconds, supports_vision, supports_thinking, embedding_dim, updated_at)
		 VALUES ('embedding', 'stub', 'http://stub.invalid', 'key', 'stub-embed', NULL, NULL, NULL, false, false, 4, $1)
		 ON CONFLICT (key) DO UPDATE SET embedding_dim = 4, updated_at = $1`, now); err != nil {
		t.Fatalf("seeding the embedding config: %v", err)
	}
}
