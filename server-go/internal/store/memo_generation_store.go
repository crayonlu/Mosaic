package store

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// MemoGenerationStore owns the reads and the guarded writes the background
// generation pipeline performs. Every write is conditional on the memo still
// sitting at the revision (and the previous value) the generation was based on,
// which is what stops an older generation overwriting a newer one.
type MemoGenerationStore struct {
	pool *pgxpool.Pool
}

func NewMemoGenerationStore(pool *pgxpool.Pool) *MemoGenerationStore {
	return &MemoGenerationStore{pool: pool}
}

// Snapshot reports a memo's current revision and update time. A generation whose
// expectations no longer match must discard its results.
func (s *MemoGenerationStore) Snapshot(
	ctx context.Context,
	memoID uuid.UUID,
) (revision int32, updatedAt int64, found bool, err error) {
	err = s.pool.QueryRow(ctx,
		`SELECT revision_count, updated_at FROM memos WHERE id = $1 AND is_deleted = false`,
		memoID).Scan(&revision, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, 0, false, nil
	}
	if err != nil {
		return 0, 0, false, err
	}
	return revision, updatedAt, true, nil
}

// ExistingTags lists the distinct tags the user already uses, which is the hint
// the auto-tag prompt is given.
func (s *MemoGenerationStore) ExistingTags(ctx context.Context, userID uuid.UUID) ([]string, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT DISTINCT tag FROM memos, jsonb_array_elements_text(tags) AS tag
		 WHERE user_id = $1 AND is_deleted = false AND jsonb_array_length(tags) > 0
		 ORDER BY tag ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tags := []string{}
	for rows.Next() {
		var tag string
		if err := rows.Scan(&tag); err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}
	return tags, rows.Err()
}

// RevisionsUpTo loads the revisions a generation is based on.
func (s *MemoGenerationStore) RevisionsUpTo(
	ctx context.Context,
	memoID uuid.UUID,
	maxRevision int32,
) ([]domain.MemoRevision, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, memo_id, user_id, revision_number, content, tags, ai_summary, is_deleted, created_at
		 FROM memo_revisions
		 WHERE memo_id = $1 AND revision_number <= $2 AND is_deleted = false
		 ORDER BY revision_number ASC`, memoID, maxRevision)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	revisions := []domain.MemoRevision{}
	for rows.Next() {
		revision, err := scanRevision(rows)
		if err != nil {
			return nil, err
		}
		revisions = append(revisions, revision)
	}
	return revisions, rows.Err()
}

// MemoByID reloads a memo so a later pipeline phase can see values written by an
// earlier one. Ownership was already resolved by the caller.
func (s *MemoGenerationStore) MemoByID(ctx context.Context, memoID uuid.UUID) (domain.Memo, error) {
	memo, err := scanMemo(s.pool.QueryRow(ctx,
		`SELECT `+memoColumns+` FROM memos WHERE id = $1 AND is_deleted = false`, memoID))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Memo{}, domain.ErrNoRows
	}
	return memo, err
}

// ApplyGeneratedTags writes model-generated tags and mirrors them onto the
// matching revision, but only while the memo is still at the revision the
// generation read and still carries the tags it started from. It reports
// whether the write applied.
func (s *MemoGenerationStore) ApplyGeneratedTags(
	ctx context.Context,
	memoID, userID uuid.UUID,
	revision int32,
	expectedTags, generatedTags []string,
	now int64,
) (bool, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	updated, err := tx.Exec(ctx,
		`UPDATE memos
		 SET tags = $1::jsonb, updated_at = GREATEST($2, updated_at + 1)
		 WHERE id = $3 AND user_id = $4 AND revision_count = $5
		   AND tags IS NOT DISTINCT FROM $6::jsonb`,
		string(marshalTags(generatedTags)), now, memoID, userID, revision,
		string(marshalTags(expectedTags)))
	if err != nil {
		return false, err
	}
	if updated.RowsAffected() == 0 {
		return false, nil
	}

	if _, err := tx.Exec(ctx,
		`UPDATE memo_revisions
		 SET tags = $1::jsonb
		 WHERE memo_id = $2 AND user_id = $3 AND revision_number = $4 AND is_deleted = false`,
		string(marshalTags(generatedTags)), memoID, userID, revision); err != nil {
		return false, err
	}

	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}

// ApplyGeneratedSummary is the summary counterpart of ApplyGeneratedTags.
func (s *MemoGenerationStore) ApplyGeneratedSummary(
	ctx context.Context,
	memoID, userID uuid.UUID,
	revision int32,
	expectedSummary *string,
	summary string,
	now int64,
) (bool, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	updated, err := tx.Exec(ctx,
		`UPDATE memos
		 SET ai_summary = $1, updated_at = GREATEST($2, updated_at + 1)
		 WHERE id = $3 AND user_id = $4 AND revision_count = $5
		   AND ai_summary IS NOT DISTINCT FROM $6`,
		summary, now, memoID, userID, revision, expectedSummary)
	if err != nil {
		return false, err
	}
	if updated.RowsAffected() == 0 {
		return false, nil
	}

	if _, err := tx.Exec(ctx,
		`UPDATE memo_revisions
		 SET ai_summary = $1
		 WHERE memo_id = $2 AND user_id = $3 AND revision_number = $4 AND is_deleted = false`,
		summary, memoID, userID, revision); err != nil {
		return false, err
	}

	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}
