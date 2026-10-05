package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// registerUserAIConfigRoutes mounts the per-user AI configuration endpoints. It
// is called from within the authenticated /api scope, so it adds no auth
// middleware of its own.
func registerUserAIConfigRoutes(r chi.Router, configs *service.UserAIConfigService) {
	serve(r, "/ai-config", map[string]http.HandlerFunc{
		http.MethodGet:    handleGetAIConfig(configs),
		http.MethodPut:    handleUpsertAIConfig(configs),
		http.MethodDelete: handleDeleteAIConfig(configs),
	})
}

func handleGetAIConfig(configs *service.UserAIConfigService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		config, err := configs.Get(r.Context(), userID)
		if err != nil {
			writeError(w, r, err)
			return
		}
		if config == nil {
			writeError(w, r, domain.NotFound("AI configuration not set"))
			return
		}
		WriteJSON(w, http.StatusOK, toAIConfigResponse(*config))
	}
}

func handleUpsertAIConfig(configs *service.UserAIConfigService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		var req upsertAIConfigRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}

		config := domain.AIConfig{
			Provider:         req.Provider,
			BaseURL:          req.BaseURL,
			APIKey:           req.APIKey,
			Model:            req.Model,
			Temperature:      req.Temperature,
			MaxTokens:        req.MaxTokens,
			TimeoutSeconds:   req.TimeoutSeconds,
			SupportsVision:   aiBoolOrFalse(req.SupportsVision),
			SupportsThinking: aiBoolOrFalse(req.SupportsThinking),
		}

		saved, err := configs.Upsert(r.Context(), userID, config)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toAIConfigResponse(saved))
	}
}

func handleDeleteAIConfig(configs *service.UserAIConfigService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		if err := configs.Delete(r.Context(), userID); err != nil {
			writeError(w, r, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
