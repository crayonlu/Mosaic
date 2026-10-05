package store

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	pgvector "github.com/pgvector/pgvector-go"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// HybridSearchStore runs the two legs of a hybrid search — a keyword match and a
// cosine-similarity match over stored embeddings — and returns the rows for the
// service layer to fuse.
type HybridSearchStore struct {
	pool *pgxpool.Pool
}

func NewHybridSearchStore(pool *pgxpool.Pool) *HybridSearchStore {
	return &HybridSearchStore{pool: pool}
}

// Search returns the keyword matches, and when the filter carries an embedding,
// the semantic matches as well. Keyword matches score 1.0; a memo found by both
// legs keeps its similarity. Rows carry no fusion score: ranking is a pure
// function the service applies.
func (s *HybridSearchStore) Search(
	ctx context.Context,
	userID uuid.UUID,
	filter domain.HybridSearchFilter,
) ([]domain.HybridHit, error) {
	keywordRows, err := s.keywordMatches(ctx, userID, filter)
	if err != nil {
		return nil, err
	}

	similarities := map[uuid.UUID]float64{}
	if filter.Semantic() {
		if similarities, err = s.semanticMatches(ctx, userID, filter); err != nil {
			return nil, err
		}
	}

	hits := make([]domain.HybridHit, 0, len(keywordRows)+len(similarities))
	seen := make(map[uuid.UUID]struct{}, len(keywordRows))

	for _, memo := range keywordRows {
		seen[memo.ID] = struct{}{}
		hits = append(hits, domain.HybridHit{
			Memo:          memo,
			KeywordScore:  1.0,
			SemanticScore: similarities[memo.ID],
		})
	}

	semanticOnly := make([]uuid.UUID, 0, len(similarities))
	for memoID := range similarities {
		if _, ok := seen[memoID]; !ok {
			semanticOnly = append(semanticOnly, memoID)
		}
	}

	if len(semanticOnly) > 0 {
		memos, err := s.memosByID(ctx, userID, semanticOnly)
		if err != nil {
			return nil, err
		}
		for _, memo := range memos {
			hits = append(hits, domain.HybridHit{
				Memo:          memo,
				KeywordScore:  0.0,
				SemanticScore: similarities[memo.ID],
			})
		}
	}

	return hits, nil
}

// keywordMatches performs the ILIKE leg over content and tags.
func (s *HybridSearchStore) keywordMatches(
	ctx context.Context,
	userID uuid.UUID,
	filter domain.HybridSearchFilter,
) ([]domain.Memo, error) {
	args := []any{userID, "%" + filter.Query + "%"}
	conditions := []string{}

	conditions, args = appendSearchFilters(conditions, args, filter)

	sql := fmt.Sprintf(
		`SELECT %s FROM memos
		 WHERE user_id = $1 AND is_deleted = false
		   AND (content ILIKE $2 OR tags::text ILIKE $2)
		   %s
		 LIMIT %d`,
		memoColumns, andAll(conditions), domain.HybridKeywordLimit)

	return collectMemos(s.pool.Query(ctx, sql, args...))
}

// semanticMatches performs the cosine-similarity leg, keeping only rows above
// the floor.
func (s *HybridSearchStore) semanticMatches(
	ctx context.Context,
	userID uuid.UUID,
	filter domain.HybridSearchFilter,
) (map[uuid.UUID]float64, error) {
	args := []any{userID, pgvector.NewVector(filter.Embedding)}
	conditions := []string{}

	conditions, args = appendSearchFilters(conditions, args, filter)

	sql := fmt.Sprintf(
		`SELECT m.id, (1.0 - (me.embedding <=> $2::vector)) AS similarity
		 FROM memos m
		 JOIN memo_embeddings me ON me.memo_id = m.id
		 WHERE m.user_id = $1 AND m.is_deleted = false
		   AND (1.0 - (me.embedding <=> $2::vector)) >= $%d
		   %s
		 ORDER BY similarity DESC
		 LIMIT %d`,
		len(args)+1, andAll(conditions), domain.HybridSemanticLimit)
	args = append(args, domain.HybridSemanticFloor)

	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	similarities := map[uuid.UUID]float64{}
	for rows.Next() {
		var (
			memoID     uuid.UUID
			similarity float64
		)
		if err := rows.Scan(&memoID, &similarity); err != nil {
			return nil, err
		}
		similarities[memoID] = similarity
	}
	return similarities, rows.Err()
}

// memosByID loads the memos a semantic match surfaced that the keyword leg
// missed.
func (s *HybridSearchStore) memosByID(
	ctx context.Context,
	userID uuid.UUID,
	ids []uuid.UUID,
) ([]domain.Memo, error) {
	return collectMemos(s.pool.Query(ctx,
		`SELECT `+memoColumns+` FROM memos
		 WHERE user_id = $1 AND is_deleted = false AND id = ANY($2)`,
		userID, ids))
}

// appendSearchFilters adds the shared structured filters, numbering each
// placeholder from the position it lands at in args.
func appendSearchFilters(
	conditions []string,
	args []any,
	filter domain.HybridSearchFilter,
) ([]string, []any) {
	add := func(value any, clause string) {
		args = append(args, value)
		conditions = append(conditions, fmt.Sprintf(clause, len(args)))
	}

	if filter.IsArchived != nil {
		add(*filter.IsArchived, "is_archived = $%d")
	}
	if len(filter.Tags) > 0 {
		add(filter.Tags, "tags ?& $%d::text[]")
	}
	if filter.FromMS != nil {
		add(*filter.FromMS, "created_at >= $%d")
	}
	if filter.ToMS != nil {
		add(*filter.ToMS, "created_at < $%d")
	}

	return conditions, args
}

func andAll(conditions []string) string {
	if len(conditions) == 0 {
		return ""
	}
	return "AND " + strings.Join(conditions, " AND ")
}
