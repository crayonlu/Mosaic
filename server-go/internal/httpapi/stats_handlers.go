package httpapi

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// registerStatsRoutes mounts the stats endpoints. It is called from within the
// authenticated /api scope, so it adds no auth middleware of its own.
func registerStatsRoutes(r chi.Router, stats *service.StatsService) {
	serve(r, "/stats/heatmap", map[string]http.HandlerFunc{
		http.MethodGet: handleStatsHeatmap(stats),
	})
	serve(r, "/stats/timeline", map[string]http.HandlerFunc{
		http.MethodGet: handleStatsTimeline(stats),
	})
	serve(r, "/stats/trends", map[string]http.HandlerFunc{
		http.MethodGet: handleStatsTrends(stats),
	})
	serve(r, "/stats/summary", map[string]http.HandlerFunc{
		http.MethodGet: handleStatsSummary(stats),
	})
}

func handleStatsHeatmap(stats *service.StatsService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		start, end, err := statsRange(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		heatMap, err := stats.HeatMap(r.Context(), userID, start, end)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, heatMap)
	}
}

func handleStatsTimeline(stats *service.StatsService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		start, end, err := statsRange(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		timeline, err := stats.Timeline(r.Context(), userID, start, end)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, timeline)
	}
}

func handleStatsTrends(stats *service.StatsService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		start, end, err := statsRange(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		trends, err := stats.Trends(r.Context(), userID, start, end)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, trends)
	}
}

func handleStatsSummary(stats *service.StatsService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		year, err := statsQueryInt(r, "year")
		if err != nil {
			writeError(w, r, err)
			return
		}
		month, err := statsQueryInt(r, "month")
		if err != nil {
			writeError(w, r, err)
			return
		}

		summary, err := stats.Summary(r.Context(), userID, year, month)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, summary)
	}
}

// statsRange parses the required startDate/endDate query parameters.
func statsRange(r *http.Request) (domain.Date, domain.Date, error) {
	start, err := domain.ParseDate(r.URL.Query().Get("startDate"))
	if err != nil {
		return domain.Date{}, domain.Date{},
			domain.InvalidInput("Invalid startDate format, expected YYYY-MM-DD")
	}
	end, err := domain.ParseDate(r.URL.Query().Get("endDate"))
	if err != nil {
		return domain.Date{}, domain.Date{},
			domain.InvalidInput("Invalid endDate format, expected YYYY-MM-DD")
	}
	return start, end, nil
}

func statsQueryInt(r *http.Request, key string) (int32, error) {
	parsed, err := strconv.Atoi(r.URL.Query().Get(key))
	if err != nil {
		return 0, domain.InvalidInputf("%s must be an integer", key)
	}
	return int32(parsed), nil
}
