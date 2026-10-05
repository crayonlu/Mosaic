package store

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// EmbeddingBackfillStore finds the memos that still have no embedding, so the
// administrative backfill can index them.
type EmbeddingBackfillStore struct {
	pool *pgxpool.Pool
}

func NewEmbeddingBackfillStore(pool *pgxpool.Pool) *EmbeddingBackfillStore {
	return &EmbeddingBackfillStore{pool: pool}
}

// MemosWithoutEmbeddings returns live memos with no memo_embeddings row, oldest
// first. Because each indexed memo leaves this set, callers page from offset
// zero rather than advancing the offset.
func (s *EmbeddingBackfillStore) MemosWithoutEmbeddings(
	ctx context.Context,
	limit, offset int64,
) ([]domain.Memo, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT `+memoColumns+`
		 FROM memos m
		 LEFT JOIN memo_embeddings me ON me.memo_id = m.id
		 WHERE m.is_deleted = FALSE AND me.memo_id IS NULL
		 ORDER BY m.created_at ASC
		 LIMIT $1 OFFSET $2`, limit, offset)
	return collectMemos(rows, err)
}
