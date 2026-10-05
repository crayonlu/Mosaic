package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

const memoColumns = `id, user_id, content, tags, is_archived, is_deleted, diary_date,
	ai_summary, created_at, updated_at, revision_count`

const memoResourceColumns = `id, memo_id, user_id, filename, resource_type, mime_type, file_size,
	storage_type, storage_path, metadata, is_deleted, ai_description, created_at, updated_at`

// ResourcesForMemo lists the live files attached to one memo.
func (s *MemoStore) ResourcesForMemo(ctx context.Context, memoID uuid.UUID) ([]domain.Resource, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT `+memoResourceColumns+` FROM resources
		 WHERE memo_id = $1 AND is_deleted = false ORDER BY created_at ASC`, memoID)
	return collectMemoResources(rows, err)
}

// ResourcesForMemos batch-loads resources for many memos, avoiding an N+1.
func (s *MemoStore) ResourcesForMemos(ctx context.Context, memoIDs []uuid.UUID) (map[uuid.UUID][]domain.Resource, error) {
	byMemo := map[uuid.UUID][]domain.Resource{}
	if len(memoIDs) == 0 {
		return byMemo, nil
	}

	rows, err := s.pool.Query(ctx,
		`SELECT `+memoResourceColumns+` FROM resources
		 WHERE memo_id = ANY($1) AND is_deleted = false ORDER BY created_at ASC`, memoIDs)
	if err != nil {
		return nil, err
	}
	resources, err := collectMemoResources(rows, nil)
	if err != nil {
		return nil, err
	}
	for _, resource := range resources {
		if resource.MemoID != nil {
			byMemo[*resource.MemoID] = append(byMemo[*resource.MemoID], resource)
		}
	}
	return byMemo, nil
}

// AssociateResources attaches unclaimed resources to a newly created memo.
func (s *MemoStore) AssociateResources(ctx context.Context, memoID uuid.UUID, resourceIDs []uuid.UUID) error {
	for _, resourceID := range resourceIDs {
		if _, err := s.pool.Exec(ctx,
			`UPDATE resources SET memo_id = $1 WHERE id = $2 AND memo_id IS NULL`,
			memoID, resourceID); err != nil {
			return err
		}
	}
	return nil
}

// ReplaceResources makes the given list the complete set attached to a memo,
// ordering the list by rewriting created_at so the batch read preserves it.
func (s *MemoStore) ReplaceResources(ctx context.Context, memoID uuid.UUID, resourceIDs []uuid.UUID, now int64) error {
	if len(resourceIDs) == 0 {
		_, err := s.pool.Exec(ctx, `UPDATE resources SET memo_id = NULL WHERE memo_id = $1`, memoID)
		return err
	}

	if _, err := s.pool.Exec(ctx,
		`UPDATE resources SET memo_id = NULL WHERE memo_id = $1 AND NOT (id = ANY($2))`,
		memoID, resourceIDs); err != nil {
		return err
	}

	for index, resourceID := range resourceIDs {
		if _, err := s.pool.Exec(ctx,
			`UPDATE resources SET memo_id = $1, created_at = $2
			 WHERE id = $3 AND (memo_id IS NULL OR memo_id = $1)`,
			memoID, now+int64(index), resourceID); err != nil {
			return err
		}
	}
	return nil
}

// EnsureRevisionDeletable rejects removing the only remaining revision.
func EnsureRevisionDeletable(active int64) error {
	if active <= 1 {
		return domain.InvalidInput("Cannot delete the last revision. Delete the memo instead.")
	}
	return nil
}

func countMemos(ctx context.Context, pool *pgxpool.Pool, where string, args []any) (int64, error) {
	var total int64
	err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM memos WHERE "+where, args...).Scan(&total)
	return total, err
}

func collectMemos(rows pgx.Rows, err error) ([]domain.Memo, error) {
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	memos := []domain.Memo{}
	for rows.Next() {
		memo, err := scanMemo(rows)
		if err != nil {
			return nil, err
		}
		memos = append(memos, memo)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return memos, nil
}

func collectMemoResources(rows pgx.Rows, err error) ([]domain.Resource, error) {
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	resources := []domain.Resource{}
	for rows.Next() {
		resource, err := scanMemoResource(rows)
		if err != nil {
			return nil, err
		}
		resources = append(resources, resource)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return resources, nil
}

func scanMemo(row pgx.Row) (domain.Memo, error) {
	var (
		memo      domain.Memo
		tags      []byte
		diaryDate *time.Time
	)
	err := row.Scan(
		&memo.ID,
		&memo.UserID,
		&memo.Content,
		&tags,
		&memo.IsArchived,
		&memo.IsDeleted,
		&diaryDate,
		&memo.AiSummary,
		&memo.CreatedAt,
		&memo.UpdatedAt,
		&memo.RevisionCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Memo{}, domain.ErrNoRows
	}
	if err != nil {
		return domain.Memo{}, err
	}
	memo.Tags = domain.TagListFromJSON(tags)
	if diaryDate != nil {
		date := domain.NewDate(*diaryDate)
		memo.DiaryDate = &date
	}
	return memo, nil
}

func scanRevision(row pgx.Row) (domain.MemoRevision, error) {
	var (
		revision domain.MemoRevision
		tags     []byte
	)
	err := row.Scan(
		&revision.ID,
		&revision.MemoID,
		&revision.UserID,
		&revision.RevisionNumber,
		&revision.Content,
		&tags,
		&revision.AiSummary,
		&revision.IsDeleted,
		&revision.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.MemoRevision{}, domain.ErrNoRows
	}
	if err != nil {
		return domain.MemoRevision{}, err
	}
	revision.Tags = domain.TagListFromJSON(tags)
	return revision, nil
}

func scanMemoResource(row pgx.Row) (domain.Resource, error) {
	var (
		resource domain.Resource
		metadata []byte
	)
	err := row.Scan(
		&resource.ID,
		&resource.MemoID,
		&resource.UserID,
		&resource.Filename,
		&resource.Type,
		&resource.MimeType,
		&resource.FileSize,
		&resource.StorageType,
		&resource.StoragePath,
		&metadata,
		&resource.IsDeleted,
		&resource.AiDescription,
		&resource.CreatedAt,
		&resource.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Resource{}, domain.ErrNoRows
	}
	if err != nil {
		return domain.Resource{}, err
	}
	if len(metadata) > 0 {
		if err := json.Unmarshal(metadata, &resource.Metadata); err != nil {
			return domain.Resource{}, err
		}
	}
	return resource, nil
}

func marshalTags(tags []string) []byte {
	if tags == nil {
		tags = []string{}
	}
	encoded, _ := json.Marshal(tags)
	return encoded
}

func dateArg(date *domain.Date) any {
	if date == nil {
		return nil
	}
	return date.Time
}
