package adapters

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// fakeBackfillSource serves a shrinking set of memos: every memo handed out is
// removed, which is what the real LEFT JOIN query does once a memo is indexed.
type fakeBackfillSource struct {
	remaining []domain.Memo
	batchSize int64
	calls     int
	err       error
}

func (f *fakeBackfillSource) MemosWithoutEmbeddings(
	_ context.Context,
	limit, offset int64,
) ([]domain.Memo, error) {
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	if offset >= int64(len(f.remaining)) {
		return nil, nil
	}

	end := offset + limit
	if end > int64(len(f.remaining)) {
		end = int64(len(f.remaining))
	}
	// Return a copy, as a query would: the caller must not observe later
	// mutations of the set through the batch it was handed.
	batch := make([]domain.Memo, end-offset)
	copy(batch, f.remaining[offset:end])
	return batch, nil
}

// fakeRefresher records each memo it is asked to embed and can be told to fail
// for specific memos, which is how a memo that never gains an embedding is
// modelled.
type fakeRefresher struct {
	failFor map[uuid.UUID]error
	done    []uuid.UUID
	onDone  func(memo domain.Memo)
}

func (f *fakeRefresher) RefreshForMemo(_ context.Context, memo domain.Memo, _ string) error {
	if err, ok := f.failFor[memo.ID]; ok {
		return err
	}
	f.done = append(f.done, memo.ID)
	if f.onDone != nil {
		f.onDone(memo)
	}
	return nil
}

func backfillMemos(count int, userID uuid.UUID) []domain.Memo {
	memos := make([]domain.Memo, 0, count)
	for i := 0; i < count; i++ {
		memos = append(memos, domain.Memo{
			ID:        uuid.New(),
			UserID:    userID,
			Content:   "entry",
			CreatedAt: int64(i),
			UpdatedAt: int64(i),
		})
	}
	return memos
}

func TestBackfillIndexesEveryMemo(t *testing.T) {
	user := uuid.New()
	source := &fakeBackfillSource{remaining: backfillMemos(5, user)}
	refresher := &fakeRefresher{onDone: func(memo domain.Memo) {
		// Mirror the real query: an indexed memo leaves the missing set.
		for i, candidate := range source.remaining {
			if candidate.ID == memo.ID {
				source.remaining = append(source.remaining[:i], source.remaining[i+1:]...)
				return
			}
		}
	}}
	backfiller := NewMemoryBackfiller(source, refresher)

	indexed, failed, users, err := backfiller.BackfillMissing(context.Background())
	if err != nil {
		t.Fatalf("BackfillMissing: %v", err)
	}

	if indexed != 5 {
		t.Errorf("indexed = %d, want 5", indexed)
	}
	if failed != 0 {
		t.Errorf("failed = %d, want 0", failed)
	}
	if users != 1 {
		t.Errorf("users = %d, want 1", users)
	}
	if len(source.remaining) != 0 {
		t.Errorf("%d memos were left unindexed", len(source.remaining))
	}
}

func TestBackfillCountsDistinctUsers(t *testing.T) {
	first, second := uuid.New(), uuid.New()
	memos := append(backfillMemos(3, first), backfillMemos(2, second)...)
	source := &fakeBackfillSource{remaining: memos}
	refresher := &fakeRefresher{onDone: func(memo domain.Memo) {
		for i, candidate := range source.remaining {
			if candidate.ID == memo.ID {
				source.remaining = append(source.remaining[:i], source.remaining[i+1:]...)
				return
			}
		}
	}}
	backfiller := NewMemoryBackfiller(source, refresher)

	indexed, _, users, err := backfiller.BackfillMissing(context.Background())
	if err != nil {
		t.Fatalf("BackfillMissing: %v", err)
	}
	if indexed != 5 {
		t.Errorf("indexed = %d, want 5", indexed)
	}
	if users != 2 {
		t.Errorf("users = %d, want 2", users)
	}
}

func TestBackfillCountsFailuresAndStillTerminates(t *testing.T) {
	user := uuid.New()
	memos := backfillMemos(3, user)
	stuck := memos[0].ID

	source := &fakeBackfillSource{remaining: memos}
	refresher := &fakeRefresher{failFor: map[uuid.UUID]error{stuck: errors.New("provider down")}}
	refresher.onDone = func(memo domain.Memo) {
		for i, candidate := range source.remaining {
			if candidate.ID == memo.ID {
				source.remaining = append(source.remaining[:i], source.remaining[i+1:]...)
				return
			}
		}
	}
	backfiller := NewMemoryBackfiller(source, refresher)

	indexed, failed, _, err := backfiller.BackfillMissing(context.Background())
	if err != nil {
		t.Fatalf("BackfillMissing: %v", err)
	}

	if indexed != 2 {
		t.Errorf("indexed = %d, want 2", indexed)
	}
	if failed != 1 {
		t.Errorf("failed = %d, want 1", failed)
	}
}

// A memo that can never be embedded stays in the missing set. The loop must
// detect the lack of progress instead of retrying it forever.
func TestBackfillStopsWhenNothingCanBeIndexed(t *testing.T) {
	user := uuid.New()
	memos := backfillMemos(2, user)

	source := &fakeBackfillSource{remaining: memos}
	refresher := &fakeRefresher{failFor: map[uuid.UUID]error{
		memos[0].ID: errors.New("provider down"),
		memos[1].ID: errors.New("provider down"),
	}}
	backfiller := NewMemoryBackfiller(source, refresher)

	indexed, failed, _, err := backfiller.BackfillMissing(context.Background())
	if err != nil {
		t.Fatalf("BackfillMissing: %v", err)
	}

	if indexed != 0 {
		t.Errorf("indexed = %d, want 0", indexed)
	}
	if failed != 2 {
		t.Errorf("failed = %d, want 2", failed)
	}
	// One batch is enough to prove there is no progress; it must not spin.
	if source.calls > 2 {
		t.Errorf("source was queried %d times, want the loop to stop after one batch", source.calls)
	}
}

func TestBackfillOnAnEmptySetIsANoOp(t *testing.T) {
	source := &fakeBackfillSource{}
	backfiller := NewMemoryBackfiller(source, &fakeRefresher{})

	indexed, failed, users, err := backfiller.BackfillMissing(context.Background())
	if err != nil {
		t.Fatalf("BackfillMissing: %v", err)
	}
	if indexed != 0 || failed != 0 || users != 0 {
		t.Errorf("counts = (%d, %d, %d), want all zero", indexed, failed, users)
	}
}

func TestBackfillReadsFromTheStartOfTheShrinkingSet(t *testing.T) {
	user := uuid.New()
	source := &fakeBackfillSource{remaining: backfillMemos(4, user)}
	refresher := &fakeRefresher{onDone: func(memo domain.Memo) {
		for i, candidate := range source.remaining {
			if candidate.ID == memo.ID {
				source.remaining = append(source.remaining[:i], source.remaining[i+1:]...)
				return
			}
		}
	}}
	backfiller := NewMemoryBackfiller(source, refresher)
	backfiller.batchSize = 1

	indexed, _, _, err := backfiller.BackfillMissing(context.Background())
	if err != nil {
		t.Fatalf("BackfillMissing: %v", err)
	}
	if indexed != 4 {
		t.Errorf("indexed = %d, want 4; paging must not skip memos that drop out", indexed)
	}
}

func TestBackfillSurfacesSourceFailures(t *testing.T) {
	sentinel := errors.New("database unavailable")
	source := &fakeBackfillSource{err: sentinel}
	backfiller := NewMemoryBackfiller(source, &fakeRefresher{})

	_, _, _, err := backfiller.BackfillMissing(context.Background())
	if !errors.Is(err, sentinel) {
		t.Fatalf("err = %v, want the source failure", err)
	}
}
