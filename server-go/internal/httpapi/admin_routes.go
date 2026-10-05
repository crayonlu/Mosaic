package httpapi

import (
	"github.com/go-chi/chi/v5"
	"net/http"

	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// registerAdminAPIRoutes mounts the admin API. It is expected to be called
// inside the already-authenticated, already-admin-guarded /admin/api scope.
func registerAdminAPIRoutes(r chi.Router, adminSvc *service.AdminService) {
	serve(r, "/health", map[string]http.HandlerFunc{
		http.MethodGet: handleAdminHealth(adminSvc),
	})
	serve(r, "/stats", map[string]http.HandlerFunc{
		http.MethodGet: handleAdminStats(adminSvc),
	})
	serve(r, "/activity", map[string]http.HandlerFunc{
		http.MethodGet: handleAdminActivity(adminSvc),
	})
	serve(r, "/config", map[string]http.HandlerFunc{
		http.MethodGet: handleAdminConfig(adminSvc),
	})

	serve(r, "/ai-config", map[string]http.HandlerFunc{
		http.MethodGet: handleAdminAIConfig(adminSvc),
	})
	serve(r, "/ai-config/{key}", map[string]http.HandlerFunc{
		http.MethodPut: handleAdminUpdateAIConfig(adminSvc),
	})
	serve(r, "/users/{userId}/ai-config", map[string]http.HandlerFunc{
		http.MethodGet: handleAdminUserAIConfig(adminSvc),
		http.MethodPut: handleAdminUpdateUserAIConfig(adminSvc),
	})

	serve(r, "/clear-cache", map[string]http.HandlerFunc{
		http.MethodPost: handleAdminClearCache(),
	})
	serve(r, "/backfill-memory", map[string]http.HandlerFunc{
		http.MethodPost: handleAdminBackfill(adminSvc),
	})

	serve(r, "/settings", map[string]http.HandlerFunc{
		http.MethodGet: handleAdminGetSettings(adminSvc),
		http.MethodPut: handleAdminUpdateSettings(adminSvc),
	})

	registerUserAdminRoutes(r, adminSvc)
}

// registerUserAdminRoutes mounts managed-user administration. The paths share
// the /users prefix with the ai-config routes.
func registerUserAdminRoutes(r chi.Router, adminSvc *service.AdminService) {
	serve(r, "/users", map[string]http.HandlerFunc{
		http.MethodPost: handleAdminCreateUser(adminSvc),
		http.MethodGet:  handleAdminListUsers(adminSvc),
	})
	serve(r, "/users/{id}", map[string]http.HandlerFunc{
		http.MethodPatch: handleAdminUpdateUser(adminSvc),
	})
}
