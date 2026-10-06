package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"

	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// Deps carries what the HTTP layer needs. Every field is required.
type Deps struct {
	Auth           AuthService
	JWTSecret      string
	AllowedOrigins []string

	Memos        *service.MemoService
	MemoSearch   *service.HybridSearchService
	Embedder     QueryEmbedder
	Diaries      *service.DiaryService
	Resources    *service.ResourceService
	Stats        *service.StatsService
	Sync         *service.SyncService
	UserAIConfig *service.UserAIConfigService
	Admin        *service.AdminService
	Bots         *service.BotService
	Memory       *service.MemoryService

	// AIConfigs and AI back the /api/ai endpoints. ParseTags is the
	// provider-independent tag extraction the suggest-tags endpoint applies to
	// the model's reply.
	AIConfigs AIConfigProvider
	AI        AICompleter
	ParseTags func(string) ([]string, error)
}

// New builds the root handler: cross-cutting middleware, the static admin UI,
// then the three authorisation scopes.
//
// The scopes mirror the previous server's boundaries. A token is still accepted
// while a password change is pending, so the account can reach the two
// endpoints that resolve it.
func New(deps Deps) http.Handler {
	router := chi.NewRouter()
	router.Use(chimiddleware.Recoverer)
	router.Use(RequestLogger())
	router.Use(CORS(deps.AllowedOrigins))

	serve(router, "/health", map[string]http.HandlerFunc{
		http.MethodGet: handleHealth,
	})
	serve(router, "/openapi.json", map[string]http.HandlerFunc{
		http.MethodGet: handleOpenAPI,
	})
	registerStaticRoutes(router)

	router.Route("/api/auth", func(r chi.Router) {
		serve(r, "/login", map[string]http.HandlerFunc{
			http.MethodPost: handleLogin(deps.Auth),
		})
		serve(r, "/refresh", map[string]http.HandlerFunc{
			http.MethodPost: handleRefresh(deps.Auth),
		})

		r.Group(func(r chi.Router) {
			r.Use(RequireAuth(deps.JWTSecret))
			serve(r, "/me", map[string]http.HandlerFunc{
				http.MethodGet: handleMe(deps.Auth),
			})
			serve(r, "/change-password", map[string]http.HandlerFunc{
				http.MethodPost: handleChangePassword(deps.Auth),
			})

			r.Group(func(r chi.Router) {
				r.Use(RequirePasswordChanged())
				serve(r, "/update-user", map[string]http.HandlerFunc{
					http.MethodPut: handleUpdateUser(deps.Auth),
				})
				serve(r, "/update-avatar", map[string]http.HandlerFunc{
					http.MethodPost: handleUpdateAvatar(deps.Auth),
				})
			})
		})
	})

	// The application API. Everything here requires a token and a resolved
	// password change.
	router.Route("/api", func(r chi.Router) {
		r.Use(RequireAuth(deps.JWTSecret))
		r.Use(RequirePasswordChanged())

		registerMemoRoutes(r, deps.Memos, deps.MemoSearch, deps.Embedder)
		registerDiaryRoutes(r, deps.Diaries)
		registerResourceRoutes(r, deps.Resources)
		registerStatsRoutes(r, deps.Stats)
		registerSyncRoutes(r, deps.Sync)
		registerUserAIConfigRoutes(r, deps.UserAIConfig)
		registerAIRoutes(r, deps.AIConfigs, deps.AI, deps.ParseTags)
		registerBotRoutes(r, deps.Bots)
		registerMemoryRoutes(r, deps.Memory)
	})

	// The admin API.
	router.Route("/admin/api", func(r chi.Router) {
		r.Use(RequireAuth(deps.JWTSecret))
		r.Use(RequireAdmin())
		registerAdminAPIRoutes(r, deps.Admin)
	})

	return router
}
