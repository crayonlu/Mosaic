package httpapi

import (
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

type memoryStatsResponse struct {
	TotalMemos   int64 `json:"totalMemos"`
	IndexedMemos int64 `json:"indexedMemos"`
}

type memoryActivityEntryResponse struct {
	ID             string `json:"id"`
	BotID          string `json:"botId"`
	BotName        string `json:"botName"`
	MemoID         string `json:"memoId"`
	RetrievedCount int64  `json:"retrievedCount"`
	PromptSize     int32  `json:"promptSize"`
	CreatedAt      int64  `json:"createdAt"`
}

type retrievedMemoItem struct {
	ID        string  `json:"id"`
	Excerpt   string  `json:"excerpt"`
	Score     float64 `json:"score"`
	Reason    string  `json:"reason"`
	CreatedAt int64   `json:"createdAt"`
}

type memoryDebugDTO struct {
	CandidateCount   int      `json:"candidateCount"`
	RetrievedMemoIDs []string `json:"retrievedMemoIds"`
	PromptChars      int      `json:"promptChars"`
}

// memoryContextResponse is the debug view. It carries the recorded
// retrievedMemos alongside the live assembled similarMemos and debug block.
type memoryContextResponse struct {
	RetrievedMemos []retrievedMemoItem `json:"retrievedMemos"`
	SimilarMemos   []retrievedMemoItem `json:"similarMemos"`
	Debug          memoryDebugDTO      `json:"debug"`
}

type memoryRetrievedResponse struct {
	RetrievedMemos []retrievedMemoItem `json:"retrievedMemos"`
}

type memoMemoryContextsResponse struct {
	Contexts map[string]memoryRetrievedResponse `json:"contexts"`
}

func memoryStatsHandler(memory *service.MemoryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		stats, err := memory.Stats(r.Context(), userID)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, memoryStatsResponse{
			TotalMemos: stats.TotalMemos, IndexedMemos: stats.IndexedMemos,
		})
	}
}

func memoryActivityHandler(memory *service.MemoryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		limit, err := parseOptionalLimit(r.URL.Query().Get("limit"))
		if err != nil {
			writeError(w, r, err)
			return
		}
		entries, err := memory.Activity(r.Context(), userID, int32(limit))
		if err != nil {
			writeError(w, r, err)
			return
		}
		response := make([]memoryActivityEntryResponse, 0, len(entries))
		for _, entry := range entries {
			response = append(response, memoryActivityEntryResponse{
				ID:             entry.ID.String(),
				BotID:          entry.BotID.String(),
				BotName:        entry.BotName,
				MemoID:         entry.MemoID.String(),
				RetrievedCount: entry.RetrievedCount,
				PromptSize:     entry.PromptSize,
				CreatedAt:      entry.CreatedAt,
			})
		}
		WriteJSON(w, http.StatusOK, response)
	}
}

func memoryContextHandler(memory *service.MemoryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		query := r.URL.Query()
		memoID, err := requiredUUIDParam(firstPresent(query, "memo_id", "memoId"), "memo_id")
		if err != nil {
			writeError(w, r, err)
			return
		}
		botID, err := requiredUUIDParam(firstPresent(query, "bot_id", "botId"), "bot_id")
		if err != nil {
			writeError(w, r, err)
			return
		}
		limit, err := parseOptionalLimitPointer(query.Get("limit"))
		if err != nil {
			writeError(w, r, err)
			return
		}

		retrieved, err := memory.Context(r.Context(), userID, memoID, botID, limit)
		if err != nil {
			writeError(w, r, err)
			return
		}
		context, err := memory.AssembleContext(r.Context(), userID, memoID)
		if err != nil {
			context = domain.BotMemoryContext{}
		}
		WriteJSON(w, http.StatusOK, memoryContextResponse{
			RetrievedMemos: toRetrievedMemoItems(retrieved),
			SimilarMemos:   toRetrievedMemoItems(context.SimilarMemos),
			Debug:          toMemoryDebugDTO(context.Debug),
		})
	}
}

func memoMemoryContextsHandler(memory *service.MemoryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		memoID, err := pathIDParam(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		limit, err := parseOptionalLimitPointer(r.URL.Query().Get("limit"))
		if err != nil {
			writeError(w, r, err)
			return
		}
		contexts, err := memory.MemoContexts(r.Context(), userID, memoID, limit)
		if err != nil {
			writeError(w, r, err)
			return
		}
		response := make(map[string]memoryRetrievedResponse, len(contexts))
		for botID, memos := range contexts {
			response[botID.String()] = memoryRetrievedResponse{
				RetrievedMemos: toRetrievedMemoItems(memos),
			}
		}
		WriteJSON(w, http.StatusOK, memoMemoryContextsResponse{Contexts: response})
	}
}

func toRetrievedMemoItems(memos []domain.RelatedMemoContext) []retrievedMemoItem {
	items := make([]retrievedMemoItem, 0, len(memos))
	for _, memo := range memos {
		items = append(items, retrievedMemoItem{
			ID:        memo.MemoID.String(),
			Excerpt:   memo.SummaryExcerpt,
			Score:     memo.RelevanceScore,
			Reason:    memo.Reason,
			CreatedAt: memo.CreatedAt,
		})
	}
	return items
}

func toMemoryDebugDTO(debug domain.BotMemoryDebugContext) memoryDebugDTO {
	ids := make([]string, 0, len(debug.RetrievedMemoIDs))
	for _, id := range debug.RetrievedMemoIDs {
		ids = append(ids, id.String())
	}
	return memoryDebugDTO{
		CandidateCount:   debug.CandidateCount,
		RetrievedMemoIDs: ids,
		PromptChars:      debug.PromptChars,
	}
}

func requiredUUIDParam(raw, field string) (uuid.UUID, error) {
	if raw == "" {
		return uuid.UUID{}, domain.InvalidInputf("%s is required", field)
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.UUID{}, domain.InvalidUUID(err)
	}
	return id, nil
}

// parseOptionalLimit reads an optional non-negative query limit.
func parseOptionalLimit(raw string) (int, error) {
	if raw == "" {
		return 0, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 0 {
		return 0, domain.InvalidInput("limit must be a non-negative integer")
	}
	return value, nil
}

func parseOptionalLimitPointer(raw string) (*int, error) {
	if raw == "" {
		return nil, nil
	}
	value, err := parseOptionalLimit(raw)
	if err != nil {
		return nil, err
	}
	return &value, nil
}
