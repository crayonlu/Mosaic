package httpapi

import (
	"context"
	"net/http"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// QueryEmbedder turns a search query into a vector using the server-wide
// embedding configuration. It is declared at the consumer, so the handler can be
// driven with a stub and no provider is contacted.
type QueryEmbedder interface {
	EmbedQuery(ctx context.Context, text string) ([]float32, error)
}

// hybridMemoResponse is a ranked result: the keyword shape plus the two scores
// and the match classification the previous server reported for hybrid results.
type hybridMemoResponse struct {
	memoResponse
	KeywordScore  float64 `json:"keywordScore"`
	SemanticScore float64 `json:"semanticScore"`
	MatchType     string  `json:"matchType"`
}

type hybridSearchResponse struct {
	Memos           []hybridMemoResponse `json:"memos"`
	Total           int64                `json:"total"`
	Page            uint32               `json:"page"`
	PageSize        uint32               `json:"pageSize"`
	SemanticEnabled bool                 `json:"semanticEnabled"`
}

// searchMemosHandler answers GET /memos/search.
//
// A non-empty query is embedded and the results are ranked by the fusion of the
// keyword and semantic legs, with semanticEnabled reporting truthfully whether
// an embedding drove the ranking. An empty query, a failing embedder or an
// all-zero vector all fall back to the keyword search alone.
func searchMemosHandler(
	memos *service.MemoService,
	hybrid *service.HybridSearchService,
	embedder QueryEmbedder,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		query, err := parseMemoSearchQuery(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		if query.Query != "" && embedder != nil && hybrid != nil {
			values, embedErr := embedder.EmbedQuery(r.Context(), query.Query)
			if service.UsableEmbedding(values, embedErr) {
				writeHybridSearch(w, r, hybrid, userID, query, values)
				return
			}
		}

		page, err := memos.Search(r.Context(), userID, query)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, searchMemosResponse{
			Memos:           toMemoResponses(page.Items),
			Total:           page.Total,
			Page:            page.Page,
			PageSize:        page.PageSize,
			SemanticEnabled: false,
		})
	}
}

func writeHybridSearch(
	w http.ResponseWriter,
	r *http.Request,
	hybrid *service.HybridSearchService,
	userID string,
	query domain.MemoSearchQuery,
	embedding []float32,
) {
	result, err := hybrid.Search(r.Context(), userID, query, embedding)
	if err != nil {
		writeError(w, r, err)
		return
	}

	items := make([]hybridMemoResponse, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, toHybridMemoResponse(item))
	}

	WriteJSON(w, http.StatusOK, hybridSearchResponse{
		Memos:           items,
		Total:           result.Total,
		Page:            result.Page,
		PageSize:        result.PageSize,
		SemanticEnabled: true,
	})
}

// toHybridMemoResponse renders a ranked memo. Hybrid results carry no resources,
// matching the previous server.
func toHybridMemoResponse(ranked domain.RankedMemo) hybridMemoResponse {
	return hybridMemoResponse{
		memoResponse: memoResponse{
			ID:            ranked.Memo.ID.String(),
			Content:       ranked.Memo.Content,
			Tags:          memoStringList(ranked.Memo.Tags),
			IsArchived:    ranked.Memo.IsArchived,
			DiaryDate:     domain.StringOrNil(ranked.Memo.DiaryDate),
			AiSummary:     ranked.Memo.AiSummary,
			CreatedAt:     ranked.Memo.CreatedAt,
			UpdatedAt:     ranked.Memo.UpdatedAt,
			RevisionCount: ranked.Memo.RevisionCount,
			Resources:     []resourceResponse{},
		},
		KeywordScore:  ranked.KeywordScore,
		SemanticScore: ranked.SemanticScore,
		MatchType:     ranked.MatchType,
	}
}
