// Command mosaic-server runs the Mosaic HTTP API.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crayonlu/mosaic/server-go/internal/adapters"
	"github.com/crayonlu/mosaic/server-go/internal/admin"
	"github.com/crayonlu/mosaic/server-go/internal/aiclient"
	"github.com/crayonlu/mosaic/server-go/internal/config"
	"github.com/crayonlu/mosaic/server-go/internal/db"
	"github.com/crayonlu/mosaic/server-go/internal/httpapi"
	"github.com/crayonlu/mosaic/server-go/internal/media"
	"github.com/crayonlu/mosaic/server-go/internal/service"
	"github.com/crayonlu/mosaic/server-go/internal/storage"
	"github.com/crayonlu/mosaic/server-go/internal/store"
)

const (
	shutdownTimeout = 30 * time.Second
	providerTimeout = 60 * time.Second
)

func main() {
	if err := run(); err != nil {
		slog.Error("server stopped", "err", err)
		os.Exit(1)
	}
}

func run() error {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("connecting to database: %w", err)
	}
	defer pool.Close()
	slog.Info("database connected")

	if err := db.Migrate(ctx, pool, cfg.MigrationsDir); err != nil {
		return err
	}

	app, err := build(ctx, cfg, pool)
	if err != nil {
		return err
	}

	app.startBackgroundWork(ctx)

	server := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.Port),
		Handler:           app.handler,
		ReadHeaderTimeout: 10 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		slog.Info("http server listening", "addr", server.Addr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	select {
	case err := <-serverErr:
		return err
	case <-ctx.Done():
	}

	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	return server.Shutdown(shutdownCtx)
}

// application is the wired server: the HTTP handler plus the background work it
// owns.
type application struct {
	handler http.Handler
	aiDiary *service.AIDiaryService
}

// startBackgroundWork runs the periodic jobs. Each is cancelled by the context
// the process is shut down with.
func (a *application) startBackgroundWork(ctx context.Context) {
	if a.aiDiary == nil {
		return
	}

	go func() {
		ticker := time.NewTicker(service.AIDiarySweepInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				claimed, err := a.aiDiary.ProcessDueJobs(ctx)
				if err != nil {
					slog.ErrorContext(ctx, "ai diary sweep failed", "err", err)
					continue
				}
				if claimed > 0 {
					slog.InfoContext(ctx, "ai diary sweep claimed jobs", "count", claimed)
				}
			}
		}
	}()
	slog.Info("ai diary sweeper started", "interval", service.AIDiarySweepInterval)
}

// build wires every collaborator. Each dependency is a required argument, so a
// wiring mistake surfaces here rather than as a nil check at request time.
func build(ctx context.Context, cfg *config.Config, pool *pgxpool.Pool) (*application, error) {
	backend, err := storage.New(storage.Config{
		Backend:   storage.Backend(string(cfg.StorageType)),
		LocalPath: cfg.LocalStoragePath,
		S3: storage.S3Config{
			Endpoint:        cfg.R2Endpoint,
			Bucket:          cfg.R2Bucket,
			AccessKeyID:     cfg.R2AccessKeyID,
			SecretAccessKey: cfg.R2SecretAccessKey,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("initialising storage: %w", err)
	}

	httpClient := &http.Client{Timeout: providerTimeout}

	userStore := store.NewUserStore(pool)
	memoStore := store.NewMemoStore(pool)
	resourceStore := store.NewResourceStore(pool)
	adminStore := store.NewAdminStore(pool)
	activity := admin.NewActivityLog(200)

	settings := service.NewAppSettingsService(store.NewAppSettingsStore(pool))
	userAIConfigs := service.NewUserAIConfigService(store.NewUserAIConfigStore(pool))
	chatConfigs := adapters.NewChatConfigs(userAIConfigs)
	blobs := adapters.NewBlobStore(backend)

	authService := service.NewAuthService(userStore, cfg.JWTSecret)
	if err := authService.EnsureAdminUser(ctx, cfg.AdminUsername, cfg.AdminPassword); err != nil {
		return nil, fmt.Errorf("ensuring admin user: %w", err)
	}
	slog.Info("admin user ensured", "username", cfg.AdminUsername)

	memoryService := service.NewMemoryService(store.NewMemoryStore(pool))
	memoryEmbeddings := service.NewMemoryEmbeddingService(
		store.NewMemoryStore(pool),
		adapters.NewEmbeddingClient(httpClient),
		adapters.NewEmbeddingConfigs(adminStore),
	)

	completer := adapters.NewBotCompleter(httpClient)
	botImages := adapters.NewBotImages(blobs, memoStore, resourceStore)

	aiDiaryService := service.NewAIDiaryService(
		store.NewAIDiaryStore(pool),
		settings,
		settings,
		chatConfigs,
		adapters.NewAIDiaryChat(httpClient),
		botImages,
	)
	botService := service.NewBotService(
		store.NewBotStore(pool),
		store.NewBotStore(pool),
		memoryService,
		chatConfigs,
		completer,
		botImages,
		settings,
		activity,
		store.NewAdvisoryLockStore(pool),
	)

	// The write-triggered pipeline needs the bot service for the auto-reply
	// fan-out, so it is built before the memo service that spawns it.
	generation := service.NewMemoGenerationService(service.GenerationDeps{
		Store:        store.NewMemoGenerationStore(pool),
		Embeddings:   memoryEmbeddings,
		Bots:         botService,
		Images:       botImages,
		Configs:      chatConfigs,
		Completions:  completer,
		Settings:     adapters.NewGenerationSettings(settings),
		Diaries:      aiDiaryService,
		ParseTags:    aiclient.ParseTagList,
		SystemPrompt: aiclient.SystemPrompt,
	})

	memoService := service.NewMemoService(
		memoStore,
		botService,
		httpapi.NewHTMLClipFetcher(httpClient, cfg.HTML2LLMURL),
		nil,
		generation,
		chatConfigs,
		completer,
		botImages,
	).WithTimezoneProvider(settings.Timezone)

	adminService := service.NewAdminService(service.AdminDeps{
		Users:      adminStore,
		Stats:      adminStore,
		Settings:   adminStore,
		AIConfig:   adminStore,
		Backfiller: adapters.NewMemoryBackfiller(store.NewEmbeddingBackfillStore(pool), memoryEmbeddings),
		Activity:   activity,
		Config:     service.AdminConfig{Port: cfg.Port, StorageType: string(cfg.StorageType)},
		StartedAt:  time.Now(),
		Version:    httpapi.Version,
	})

	handler := httpapi.New(httpapi.Deps{
		Auth:           authService,
		JWTSecret:      cfg.JWTSecret,
		AllowedOrigins: cfg.AllowedOrigins,

		Memos:        memoService,
		MemoSearch:   service.NewHybridSearchService(store.NewHybridSearchStore(pool), settings.Timezone),
		Embedder:     memoryEmbeddings,
		Diaries:      service.NewDiaryService(store.NewDiaryStore(pool)),
		Resources:    newResourceService(cfg, pool, blobs, resourceStore, userStore, chatConfigs, completer),
		Stats:        service.NewStatsService(store.NewStatsStore(pool), settings),
		Sync:         service.NewSyncService(store.NewSyncStore(pool)),
		UserAIConfig: userAIConfigs,
		Admin:        adminService,
		Bots:         botService,
		Memory:       memoryService,

		AIConfigs: chatConfigs,
		AI:        adapters.NewCompleter(httpClient),
		ParseTags: aiclient.ParseTagList,
	})

	return &application{handler: handler, aiDiary: aiDiaryService}, nil
}

func newResourceService(
	cfg *config.Config,
	pool *pgxpool.Pool,
	blobs *adapters.BlobStore,
	resourceStore *store.ResourceStore,
	userStore *store.UserStore,
	configs service.ChatConfigProvider,
	completions service.CompletionClient,
) *service.ResourceService {
	return service.NewResourceService(
		resourceStore,
		blobs,
		media.NewImageProcessor(),
		media.NewVideoProcessor(cfg.FFmpegBinary),
		adapters.NewAvatars(userStore, cfg.LocalStoragePath, cfg.StorageType == config.StorageLocal),
		cfg.StorageType,
		configs,
		completions,
	)
}
