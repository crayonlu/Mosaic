package httpapi

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/crayonlu/mosaic/server-go/internal/service"
)

func handleAdminHealth(adminSvc *service.AdminService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		health := adminSvc.Health(r.Context())
		WriteJSON(w, http.StatusOK, adminHealthResponse{
			Uptime:               health.Uptime,
			StartedAt:            health.StartedAt,
			Version:              health.Version,
			StorageType:          health.StorageType,
			StorageUsed:          health.StorageUsed,
			StorageUsedFormatted: health.StorageUsedFormatted,
			DBSize:               health.DBSize,
			DBSizeFormatted:      health.DBSizeFormatted,
		})
	}
}

func handleAdminStats(adminSvc *service.AdminService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		stats, err := adminSvc.Stats(r.Context())
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, adminStatsResponse{
			Memos:         toAdminCountWithMonth(stats.Memos),
			Diaries:       toAdminCountWithMonth(stats.Diaries),
			Resources:     toAdminResourceStats(stats.Resources),
			Bots:          toAdminBotStats(stats.Bots),
			ActiveDays:    stats.ActiveDays,
			LongestStreak: stats.LongestStreak,
		})
	}
}

func handleAdminActivity(adminSvc *service.AdminService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		limit := queryInt(query.Get("limit"), 50)
		var level *string
		if value := query.Get("level"); value != "" {
			level = &value
		}

		entries := adminSvc.ListActivity(limit, level)
		out := make([]adminActivityEntry, 0, len(entries))
		for _, entry := range entries {
			out = append(out, adminActivityEntry{
				Timestamp:  entry.Timestamp,
				Action:     entry.Action,
				EntityType: entry.EntityType,
				EntityID:   entry.EntityID,
				Level:      entry.Level,
				Detail:     entry.Detail,
			})
		}
		WriteJSON(w, http.StatusOK, adminActivityResponse{Entries: out})
	}
}

func handleAdminConfig(adminSvc *service.AdminService) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		cfg := adminSvc.Config()
		WriteJSON(w, http.StatusOK, adminConfigResponse{
			Port:        cfg.Port,
			StorageType: cfg.StorageType,
		})
	}
}

func handleAdminAIConfig(adminSvc *service.AdminService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		adminID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		pair, err := adminSvc.AdminAIConfig(r.Context(), adminID)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, adminAIConfigResponse{
			Bot:       toAdminAIConfigDTO(pair.Bot),
			Embedding: toAdminAIConfigDTO(pair.Embedding),
		})
	}
}

func handleAdminUpdateAIConfig(adminSvc *service.AdminService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := chi.URLParam(r, "key")
		if key != "bot" && key != "embedding" {
			// The previous server used a bespoke body for this one rejection.
			WriteJSON(w, http.StatusBadRequest, errorBody{
				Error: "Bad Request", Message: "Unsupported AI config key",
			})
			return
		}

		var payload adminAIConfigPayload
		if err := decodeJSON(r, &payload); err != nil {
			writeError(w, r, err)
			return
		}
		adminID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		view, err := adminSvc.UpdateAdminAIConfig(r.Context(), adminID, key, payload.input())
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toAdminAIConfigDTO(view))
	}
}

func handleAdminUserAIConfig(adminSvc *service.AdminService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		view, err := adminSvc.AdminUserAIConfig(r.Context(), chi.URLParam(r, "userId"))
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toAdminAIConfigDTO(view))
	}
}

func handleAdminUpdateUserAIConfig(adminSvc *service.AdminService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var payload adminAIConfigPayload
		if err := decodeJSON(r, &payload); err != nil {
			writeError(w, r, err)
			return
		}

		view, err := adminSvc.UpdateAdminUserAIConfig(
			r.Context(), chi.URLParam(r, "userId"), payload.input())
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toAdminAIConfigDTO(view))
	}
}

func handleAdminClearCache() http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		WriteJSON(w, http.StatusOK, adminMessageResponse{Message: "Cache cleared"})
	}
}

func handleAdminBackfill(adminSvc *service.AdminService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		adminSvc.StartBackfill(r.Context())
		WriteJSON(w, http.StatusOK, adminMessageResponse{
			Message: "Backfill started in background. Check server logs for progress.",
		})
	}
}

func handleAdminGetSettings(adminSvc *service.AdminService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		settings, err := adminSvc.GetSettings(r.Context())
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toAdminSettingsPayload(settings))
	}
}

func handleAdminUpdateSettings(adminSvc *service.AdminService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var payload adminSettingsPayload
		if err := decodeJSON(r, &payload); err != nil {
			writeError(w, r, err)
			return
		}

		settings := service.AdminSettings{
			AutoTagEnabled:     payload.AutoTagEnabled,
			AutoSummaryEnabled: payload.AutoSummaryEnabled,
			AutoDiaryEnabled:   payload.AutoDiaryEnabled,
			AutoDiaryMinMemos:  payload.AutoDiaryMinMemos,
			AutoDiaryMinChars:  payload.AutoDiaryMinChars,
			AppTimezone:        payload.AppTimezone,
		}
		if err := adminSvc.UpdateSettings(r.Context(), settings); err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, payload)
	}
}

func (p adminAIConfigPayload) input() service.AdminAIConfigInput {
	return service.AdminAIConfigInput{
		Provider:         p.Provider,
		BaseURL:          p.BaseURL,
		APIKey:           p.APIKey,
		Model:            p.Model,
		Temperature:      p.Temperature,
		MaxTokens:        p.MaxTokens,
		TimeoutSeconds:   p.TimeoutSeconds,
		SupportsVision:   p.SupportsVision,
		SupportsThinking: p.SupportsThinking,
		EmbeddingDim:     p.EmbeddingDim,
	}
}

func toAdminAIConfigDTO(view service.AdminAIConfigView) adminAIConfigDTO {
	return adminAIConfigDTO{
		Key:              view.Key,
		Provider:         view.Provider,
		BaseURL:          view.BaseURL,
		APIKey:           view.APIKey,
		Model:            view.Model,
		Temperature:      view.Temperature,
		MaxTokens:        view.MaxTokens,
		TimeoutSeconds:   view.TimeoutSeconds,
		SupportsVision:   view.SupportsVision,
		SupportsThinking: view.SupportsThinking,
		EmbeddingDim:     view.EmbeddingDim,
		UpdatedAt:        view.UpdatedAt,
	}
}

func toAdminCountWithMonth(counts service.AdminCountWithMonth) adminCountWithMonth {
	return adminCountWithMonth{Total: counts.Total, ThisMonth: counts.ThisMonth}
}

func toAdminResourceStats(stats service.AdminResourceStats) adminResourceStats {
	return adminResourceStats{
		Total:              stats.Total,
		TotalSize:          stats.TotalSize,
		TotalSizeFormatted: stats.TotalSizeFormatted,
	}
}

func toAdminBotStats(stats service.AdminBotStats) adminBotStats {
	return adminBotStats{
		Total:        stats.Total,
		AutoReply:    stats.AutoReply,
		TotalReplies: stats.TotalReplies,
	}
}

func toAdminSettingsPayload(settings service.AdminSettings) adminSettingsPayload {
	return adminSettingsPayload{
		AutoTagEnabled:     settings.AutoTagEnabled,
		AutoSummaryEnabled: settings.AutoSummaryEnabled,
		AutoDiaryEnabled:   settings.AutoDiaryEnabled,
		AutoDiaryMinMemos:  settings.AutoDiaryMinMemos,
		AutoDiaryMinChars:  settings.AutoDiaryMinChars,
		AppTimezone:        settings.AppTimezone,
	}
}

// queryInt parses an integer query parameter, falling back on absence or error.
func queryInt(raw string, fallback int) int {
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return value
}
