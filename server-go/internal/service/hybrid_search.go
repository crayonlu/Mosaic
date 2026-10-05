package service

import (
	"context"
	"sort"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// HybridSearchStore performs the two retrieval legs a hybrid search fuses.
type HybridSearchStore interface {
	Search(
		ctx context.Context,
		userID uuid.UUID,
		filter domain.HybridSearchFilter,
	) ([]domain.HybridHit, error)
}

// HybridSearchService ranks a user's memos by a fusion of keyword match and
// cosine similarity over their stored embeddings.
type HybridSearchService struct {
	store    HybridSearchStore
	timezone func(context.Context) *time.Location
}

// NewHybridSearchService wires the store and the timezone source the date
// filters are resolved against. Both are required.
func NewHybridSearchService(
	store HybridSearchStore,
	timezone func(context.Context) *time.Location,
) *HybridSearchService {
	if timezone == nil {
		timezone = func(context.Context) *time.Location { return orShanghai(nil) }
	}
	return &HybridSearchService{store: store, timezone: timezone}
}

// HybridSearchResult is one page of fused results.
type HybridSearchResult struct {
	Items    []domain.RankedMemo
	Total    int64
	Page     uint32
	PageSize uint32
}

// Search returns one page of ranked results. An empty Embedding skips the
// semantic leg, which is what the caller does when no query embedding could be
// produced.
func (s *HybridSearchService) Search(
	ctx context.Context,
	userID string,
	query domain.MemoSearchQuery,
	embedding []float32,
) (HybridSearchResult, error) {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return HybridSearchResult{}, domain.InvalidUUID(err)
	}

	page, pageSize := domain.NormalizePage(query.Page, query.PageSize, defaultSearchPageSize)

	fromMS, toMS, err := s.bounds(ctx, query)
	if err != nil {
		return HybridSearchResult{}, err
	}

	hits, err := s.store.Search(ctx, userUUID, domain.HybridSearchFilter{
		Query:      query.Query,
		Tags:       query.Tags,
		IsArchived: query.IsArchived,
		FromMS:     fromMS,
		ToMS:       toMS,
		Embedding:  embedding,
	})
	if err != nil {
		return HybridSearchResult{}, domain.Internal(err)
	}

	ranked := RankHybridHits(hits, len(embedding) > 0)
	total := int64(len(ranked))

	offset := int((page - 1) * pageSize)
	if offset > len(ranked) {
		offset = len(ranked)
	}
	end := offset + int(pageSize)
	if end > len(ranked) {
		end = len(ranked)
	}

	return HybridSearchResult{
		Items:    ranked[offset:end],
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// bounds converts the query's date strings into the millisecond window the
// store filters on, in the configured timezone.
func (s *HybridSearchService) bounds(
	ctx context.Context,
	query domain.MemoSearchQuery,
) (fromMS, toMS *int64, err error) {
	location := s.timezone(ctx)

	if query.StartDate != nil {
		start, _, err := DateBounds(*query.StartDate, location)
		if err != nil {
			return nil, nil, err
		}
		fromMS = &start
	}
	if query.EndDate != nil {
		_, end, err := DateBounds(*query.EndDate, location)
		if err != nil {
			return nil, nil, err
		}
		toMS = &end
	}
	return fromMS, toMS, nil
}

// RankHybridHits fuses the keyword and semantic scores, drops the results below
// the final-score floor when a semantic leg participated, and orders by the
// fused score. It is pure, so the ranking can be tested without a database.
func RankHybridHits(hits []domain.HybridHit, semanticEnabled bool) []domain.RankedMemo {
	ranked := make([]domain.RankedMemo, 0, len(hits))

	for _, hit := range hits {
		finalScore := FuseHybridScores(hit.KeywordScore, hit.SemanticScore)
		if !HybridResultSurvives(finalScore, semanticEnabled) {
			continue
		}
		ranked = append(ranked, domain.RankedMemo{
			Memo:          hit.Memo,
			KeywordScore:  hit.KeywordScore,
			SemanticScore: hit.SemanticScore,
			FinalScore:    finalScore,
			MatchType:     HybridMatchType(hit.KeywordScore, hit.SemanticScore),
		})
	}

	sort.SliceStable(ranked, func(i, j int) bool {
		return ranked[i].FinalScore > ranked[j].FinalScore
	})
	return ranked
}

// UsableEmbedding reports whether a query embedding can drive the semantic leg.
// A provider that returned nothing, an error, or an all-zero vector leaves the
// search keyword-only.
func UsableEmbedding(embedding []float32, err error) bool {
	if err != nil || len(embedding) == 0 {
		return false
	}
	for _, value := range embedding {
		if value != 0 {
			return true
		}
	}
	return false
}
