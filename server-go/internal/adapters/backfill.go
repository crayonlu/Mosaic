package adapters

import (
	"context"
	"log/slog"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// backfillBatchSize matches the previous server's batch size.
const backfillBatchSize = 200

// EmbeddingRefresher regenerates the stored embedding for one memo.
type EmbeddingRefresher interface {
	RefreshForMemo(ctx context.Context, memo domain.Memo, revisionContext string) error
}

// BackfillSource lists the memos that still lack an embedding.
type BackfillSource interface {
	MemosWithoutEmbeddings(ctx context.Context, limit, offset int64) ([]domain.Memo, error)
}

// MemoryBackfiller indexes memos whose embedding is missing.
//
// Each indexed memo leaves the "missing" set, so every round reads from offset
// zero. The previous server advanced its offset while the set shrank, which
// skipped roughly every other memo; that is corrected here.
type MemoryBackfiller struct {
	memos      BackfillSource
	embeddings EmbeddingRefresher
	batchSize  int64
}

func NewMemoryBackfiller(memos BackfillSource, embeddings EmbeddingRefresher) *MemoryBackfiller {
	return &MemoryBackfiller{memos: memos, embeddings: embeddings, batchSize: backfillBatchSize}
}

// BackfillMissing indexes every memo that lacks an embedding. It stops when the
// missing set is empty, when the context ends, or when a batch makes no
// progress, so a memo that cannot be embedded can never spin the loop forever.
// Each memo is attempted once per run.
func (b *MemoryBackfiller) BackfillMissing(
	ctx context.Context,
) (indexed, failed, users int64, err error) {
	affected := map[uuid.UUID]struct{}{}
	attempted := map[uuid.UUID]struct{}{}

	for {
		if err := ctx.Err(); err != nil {
			return indexed, failed, int64(len(affected)), err
		}

		batch, batchErr := b.memos.MemosWithoutEmbeddings(ctx, b.batchSize, 0)
		if batchErr != nil {
			return indexed, failed, int64(len(affected)), batchErr
		}
		if len(batch) == 0 {
			break
		}

		progressed := false
		for _, memo := range batch {
			if _, seen := attempted[memo.ID]; seen {
				continue
			}
			attempted[memo.ID] = struct{}{}
			affected[memo.UserID] = struct{}{}

			if refreshErr := b.embeddings.RefreshForMemo(ctx, memo, ""); refreshErr != nil {
				slog.ErrorContext(ctx, "backfill: embedding failed",
					"memoId", memo.ID, "err", refreshErr)
				failed++
				continue
			}
			indexed++
			progressed = true
		}

		if !progressed {
			slog.WarnContext(ctx, "backfill: no further progress, stopping",
				"batchSize", len(batch), "failed", failed)
			break
		}
	}

	slog.InfoContext(ctx, "backfill complete",
		"indexed", indexed, "failed", failed, "users", len(affected))
	return indexed, failed, int64(len(affected)), nil
}
