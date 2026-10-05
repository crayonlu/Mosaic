package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

func createMemoHandler(memos *service.MemoService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		var req createMemoRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}
		input, err := req.toInput()
		if err != nil {
			writeError(w, r, err)
			return
		}

		memo, err := memos.Create(r.Context(), userID, input)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toMemoResponse(memo))
	}
}

func listMemosHandler(memos *service.MemoService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		filter, err := parseMemoListFilter(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		page, err := memos.List(r.Context(), userID, filter)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toPaginatedMemoResponse(page))
	}
}

func getMemoHandler(memos *service.MemoService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		memoID, err := memoIDParam(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		memo, err := memos.Get(r.Context(), userID, memoID)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toMemoResponse(memo))
	}
}

func memoDetailHandler(memos *service.MemoService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		memoID, err := memoIDParam(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		detail, err := memos.Detail(r.Context(), userID, memoID)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, memoDetailResponse{
			Memo:       toMemoResponse(service.MemoWithResources{Memo: detail.Memo, Resources: detail.Resources}),
			Revisions:  toRevisionResponses(detail.Revisions),
			BotReplies: toBotReplyNodeResponses(detail.BotReplies),
		})
	}
}

func updateMemoHandler(memos *service.MemoService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		memoID, err := memoIDParam(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		var req updateMemoRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}
		input, err := req.toInput()
		if err != nil {
			writeError(w, r, err)
			return
		}

		memo, err := memos.Update(r.Context(), userID, memoID, input)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toMemoResponse(memo))
	}
}

func deleteMemoHandler(memos *service.MemoService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		memoID, err := memoIDParam(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		if err := memos.Delete(r.Context(), userID, memoID); err != nil {
			writeError(w, r, err)
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}

func memosByDateHandler(memos *service.MemoService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		archived, err := parseOptionalBool(r.URL.Query().Get("archived"), "archived")
		if err != nil {
			writeError(w, r, err)
			return
		}

		memosByDate, err := memos.ByCreatedDate(r.Context(), userID, chi.URLParam(r, "date"), archived)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toMemoResponses(memosByDate))
	}
}

func listTagsHandler(memos *service.MemoService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		tags, err := memos.Tags(r.Context(), userID)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, tags)
	}
}

func clipHandler(memos *service.MemoService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		var req clipRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}

		result, err := memos.Clip(r.Context(), userID, service.ClipInput{
			ClipType:   req.ClipType,
			URL:        req.URL,
			Content:    req.Content,
			ResourceID: req.ResourceID,
			UserNote:   req.UserNote,
		})
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toClipResultResponse(result))
	}
}

func revisionsHandler(memos *service.MemoService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		memoID, err := memoIDParam(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		revisions, err := memos.Revisions(r.Context(), userID, memoID)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toRevisionResponses(revisions))
	}
}

func deleteRevisionHandler(memos *service.MemoService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		memoID, err := memoIDParam(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		revisionID, err := uuid.Parse(chi.URLParam(r, "revisionID"))
		if err != nil {
			writeError(w, r, domain.InvalidUUID(err))
			return
		}

		if err := memos.DeleteRevision(r.Context(), userID, memoID, revisionID); err != nil {
			writeError(w, r, err)
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}

func archiveMemoHandler(memos *service.MemoService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		memoID, err := memoIDParam(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		var req archiveMemoRequest
		if err := decodeOptionalJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}

		var diaryDate *domain.Date
		if req.DiaryDate != nil {
			date, err := domain.ParseDate(*req.DiaryDate)
			if err != nil {
				writeError(w, r, err)
				return
			}
			diaryDate = &date
		}

		if err := memos.Archive(r.Context(), userID, memoID, diaryDate); err != nil {
			writeError(w, r, err)
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}

func unarchiveMemoHandler(memos *service.MemoService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		memoID, err := memoIDParam(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		if err := memos.Unarchive(r.Context(), userID, memoID); err != nil {
			writeError(w, r, err)
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}
