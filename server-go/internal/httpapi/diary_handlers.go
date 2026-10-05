package httpapi

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// registerDiaryRoutes mounts the diary endpoints. It is called from within the
// authenticated /api scope, so it adds no auth middleware of its own.
func registerDiaryRoutes(r chi.Router, diaries *service.DiaryService) {
	serve(r, "/diaries", map[string]http.HandlerFunc{
		http.MethodGet: handleListDiaries(diaries),
	})
	serve(r, "/diaries/{date}", map[string]http.HandlerFunc{
		http.MethodGet:  handleGetDiary(diaries),
		http.MethodPost: handleCreateDiary(diaries),
		http.MethodPut:  handleUpdateDiary(diaries),
	})
	serve(r, "/diaries/{date}/summary", map[string]http.HandlerFunc{
		http.MethodPut: handleUpdateDiarySummary(diaries),
	})
	serve(r, "/diaries/{date}/mood", map[string]http.HandlerFunc{
		http.MethodPut: handleUpdateDiaryMood(diaries),
	})
}

func handleListDiaries(diaries *service.DiaryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		page, err := diaryUintQuery(r, "page")
		if err != nil {
			writeError(w, r, err)
			return
		}
		pageSize, err := diaryUintQuery(r, "pageSize")
		if err != nil {
			writeError(w, r, err)
			return
		}
		startDate, err := diaryOptionalDate(r, "startDate")
		if err != nil {
			writeError(w, r, err)
			return
		}
		endDate, err := diaryOptionalDate(r, "endDate")
		if err != nil {
			writeError(w, r, err)
			return
		}

		result, err := diaries.List(r.Context(), userID, domain.DiaryFilter{
			Page:      page,
			PageSize:  pageSize,
			StartDate: startDate,
			EndDate:   endDate,
		})
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toPaginatedDiaryResponse(result))
	}
}

func handleGetDiary(diaries *service.DiaryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		date, err := diaryPathDate(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		detail, err := diaries.Get(r.Context(), userID, date)
		if err != nil {
			writeError(w, r, err)
			return
		}
		if detail == nil {
			WriteJSON(w, http.StatusOK, nil)
			return
		}
		WriteJSON(w, http.StatusOK, toDiaryWithMemosResponse(*detail))
	}
}

func handleCreateDiary(diaries *service.DiaryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		date, err := diaryPathDate(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		var req createDiaryRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}
		if !diaryValidMoodScore(req.MoodScore) {
			writeError(w, r, diaryMoodScoreError())
			return
		}

		diary, err := diaries.Create(r.Context(), userID, date, req.Summary, req.MoodKey, req.MoodScore)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toDiaryResponse(diary))
	}
}

func handleUpdateDiary(diaries *service.DiaryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		date, err := diaryPathDate(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		var req updateDiaryRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}
		if req.MoodScore != nil && !diaryValidMoodScore(*req.MoodScore) {
			writeError(w, r, diaryMoodScoreError())
			return
		}

		diary, err := diaries.Update(r.Context(), userID, date, req.Summary, req.MoodKey, req.MoodScore)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toDiaryResponse(diary))
	}
}

func handleUpdateDiarySummary(diaries *service.DiaryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		date, err := diaryPathDate(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		var req updateDiarySummaryRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}

		diary, err := diaries.UpdateSummary(r.Context(), userID, date, req.Summary)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toDiaryResponse(diary))
	}
}

func handleUpdateDiaryMood(diaries *service.DiaryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		date, err := diaryPathDate(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		var req updateDiaryMoodRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}
		if !diaryValidMoodScore(req.MoodScore) {
			writeError(w, r, diaryMoodScoreError())
			return
		}

		diary, err := diaries.UpdateMood(r.Context(), userID, date, req.MoodKey, req.MoodScore)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toDiaryResponse(diary))
	}
}

// diaryPathDate parses the {date} path segment, matching the previous server's
// error text for a malformed value.
func diaryPathDate(r *http.Request) (domain.Date, error) {
	date, err := domain.ParseDate(chi.URLParam(r, "date"))
	if err != nil {
		return domain.Date{}, domain.InvalidInput("Invalid date format. Use YYYY-MM-DD")
	}
	return date, nil
}

// diaryUintQuery parses an optional unsigned query parameter. An absent value is
// zero, which the service normalizes to its default.
func diaryUintQuery(r *http.Request, key string) (uint32, error) {
	raw := r.URL.Query().Get(key)
	if raw == "" {
		return 0, nil
	}
	parsed, err := strconv.ParseUint(raw, 10, 32)
	if err != nil {
		return 0, domain.InvalidInputf("%s must be a positive integer", key)
	}
	return uint32(parsed), nil
}

func diaryOptionalDate(r *http.Request, key string) (*domain.Date, error) {
	raw := r.URL.Query().Get(key)
	if raw == "" {
		return nil, nil
	}
	date, err := domain.ParseDate(raw)
	if err != nil {
		return nil, domain.InvalidInputf("invalid %s, expected YYYY-MM-DD", key)
	}
	return &date, nil
}

func diaryValidMoodScore(score int32) bool {
	return score >= 1 && score <= 10
}

func diaryMoodScoreError() error {
	return domain.InvalidInput("moodScore must be between 1 and 10")
}
