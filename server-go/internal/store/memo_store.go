// Package store holds the SQL access layer. Services depend on the interfaces
// they declare themselves, so persistence stays behind a seam that tests can
// replace with a fake.
package store

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// MemoStore reads and writes the memos and memo_revisions tables.
type MemoStore struct {
	pool *pgxpool.Pool
}

func NewMemoStore(pool *pgxpool.Pool) *MemoStore {
	return &MemoStore{pool: pool}
}

// Create inserts a memo and its initial revision in one transaction so they can
// never diverge.
func (s *MemoStore) Create(ctx context.Context, memo domain.Memo, initial domain.MemoRevision) (domain.Memo, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return domain.Memo{}, err
	}
	defer tx.Rollback(ctx)

	created, err := scanMemo(tx.QueryRow(ctx,
		`INSERT INTO memos (id, user_id, content, tags, is_archived, is_deleted, diary_date,
			ai_summary, created_at, updated_at, revision_count)
		 VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11)
		 RETURNING `+memoColumns,
		memo.ID, memo.UserID, memo.Content, marshalTags(memo.Tags), memo.IsArchived,
		memo.IsDeleted, dateArg(memo.DiaryDate), memo.AiSummary, memo.CreatedAt,
		memo.UpdatedAt, memo.RevisionCount))
	if err != nil {
		return domain.Memo{}, err
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO memo_revisions (id, memo_id, user_id, revision_number, content, tags,
			ai_summary, is_deleted, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, false, $8)`,
		initial.ID, initial.MemoID, initial.UserID, initial.RevisionNumber,
		initial.Content, marshalTags(initial.Tags), initial.AiSummary,
		initial.CreatedAt); err != nil {
		return domain.Memo{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Memo{}, err
	}
	return created, nil
}

// ByID looks up a live memo owned by the user.
func (s *MemoStore) ByID(ctx context.Context, userID, memoID uuid.UUID) (domain.Memo, error) {
	return scanMemo(s.pool.QueryRow(ctx,
		`SELECT `+memoColumns+` FROM memos
		 WHERE id = $1 AND user_id = $2 AND is_deleted = false`, memoID, userID))
}

// Update applies the supplied fields, bumps updated_at, and records a revision
// whenever the content changes. revision_count tracks the highest-ever revision
// number and is only incremented for content changes.
func (s *MemoStore) Update(
	ctx context.Context,
	userID, memoID uuid.UUID,
	content *string,
	tags *[]string,
	isArchived *bool,
	diaryDate *domain.Date,
	clearDiaryDate bool,
	aiSummary *string,
	now int64,
) (domain.Memo, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return domain.Memo{}, err
	}
	defer tx.Rollback(ctx)

	set := []string{"updated_at = GREATEST($1, updated_at + 1)"}
	args := []any{now}
	add := func(clause string, value any) {
		args = append(args, value)
		set = append(set, fmt.Sprintf(clause, len(args)))
	}

	if content != nil {
		add("content = $%d", *content)
	}
	if tags != nil {
		add("tags = $%d::jsonb", marshalTags(*tags))
	}
	if isArchived != nil {
		add("is_archived = $%d", *isArchived)
	}
	if diaryDate != nil {
		add("diary_date = $%d", diaryDate.Time)
	} else if clearDiaryDate {
		set = append(set, "diary_date = NULL")
	}
	if aiSummary != nil {
		add("ai_summary = $%d", *aiSummary)
	}
	if content != nil {
		set = append(set, "revision_count = revision_count + 1")
	}

	args = append(args, memoID, userID)
	query := fmt.Sprintf("UPDATE memos SET %s WHERE id = $%d AND user_id = $%d RETURNING %s",
		strings.Join(set, ", "), len(args)-1, len(args), memoColumns)

	memo, err := scanMemo(tx.QueryRow(ctx, query, args...))
	if err != nil {
		return domain.Memo{}, err
	}

	if content != nil {
		if _, err := tx.Exec(ctx,
			`INSERT INTO memo_revisions (id, memo_id, user_id, revision_number, content, tags,
				ai_summary, is_deleted, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, false, $8)`,
			uuid.New(), memo.ID, userID, memo.RevisionCount, memo.Content,
			marshalTags(memo.Tags), memo.AiSummary, now); err != nil {
			return domain.Memo{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Memo{}, err
	}
	return memo, nil
}

// SoftDelete marks a memo deleted without removing its rows.
func (s *MemoStore) SoftDelete(ctx context.Context, userID, memoID uuid.UUID, now int64) error {
	tag, err := s.pool.Exec(ctx,
		`UPDATE memos SET is_deleted = true, updated_at = GREATEST($1, updated_at + 1)
		 WHERE id = $2 AND user_id = $3`, now, memoID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNoRows
	}
	return nil
}

// SetArchived flips the archived flag. When a diary date is supplied it is
// written at the same time, as archive-with-date does in the previous server.
func (s *MemoStore) SetArchived(
	ctx context.Context,
	userID, memoID uuid.UUID,
	archived bool,
	diaryDate *domain.Date,
	now int64,
) error {
	var (
		tag pgconn.CommandTag
		err error
	)
	if archived && diaryDate != nil {
		tag, err = s.pool.Exec(ctx,
			`UPDATE memos SET is_archived = true, diary_date = $1,
				updated_at = GREATEST($2, updated_at + 1)
			 WHERE id = $3 AND user_id = $4 AND is_deleted = false`,
			diaryDate.Time, now, memoID, userID)
	} else {
		tag, err = s.pool.Exec(ctx,
			`UPDATE memos SET is_archived = $1, updated_at = GREATEST($2, updated_at + 1)
			 WHERE id = $3 AND user_id = $4 AND is_deleted = false`,
			archived, now, memoID, userID)
	}
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNoRows
	}
	return nil
}

// List pages through memos applying the filter precedence of the previous
// server: a search term wins over a diary date, which wins over the archived
// flag.
func (s *MemoStore) List(
	ctx context.Context,
	userID uuid.UUID,
	filter domain.MemoListFilter,
	offset uint32,
) ([]domain.Memo, int64, error) {
	args := []any{userID}
	where := "user_id = $1 AND is_deleted = false"
	countWhere := where

	switch {
	case filter.Search != nil:
		pattern := "%" + *filter.Search + "%"
		args = append(args, pattern)
		clause := fmt.Sprintf(" AND (content ILIKE $%d OR tags::text ILIKE $%d)", len(args), len(args))
		where += clause
		countWhere += clause
	case filter.DiaryDate != nil:
		args = append(args, filter.DiaryDate.Time)
		where += fmt.Sprintf(" AND diary_date = $%d AND is_archived = true", len(args))
		countWhere += fmt.Sprintf(" AND diary_date = $%d", len(args))
	case filter.Archived != nil:
		args = append(args, *filter.Archived)
		where += fmt.Sprintf(" AND is_archived = $%d", len(args))
		countWhere += fmt.Sprintf(" AND is_archived = $%d", len(args))
	}

	total, err := countMemos(ctx, s.pool, countWhere, args)
	if err != nil {
		return nil, 0, err
	}

	args = append(args, int64(filter.PageSize), int64(offset))
	query := fmt.Sprintf("SELECT %s FROM memos WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		memoColumns, where, len(args)-1, len(args))

	memos, err := collectMemos(s.pool.Query(ctx, query, args...))
	if err != nil {
		return nil, 0, err
	}
	return memos, total, nil
}

// ByCreatedDate returns the memos created inside a millisecond window.
func (s *MemoStore) ByCreatedDate(
	ctx context.Context,
	userID uuid.UUID,
	startMS, endMS int64,
	archived *bool,
) ([]domain.Memo, error) {
	args := []any{userID, startMS, endMS}
	where := "user_id = $1 AND is_deleted = false AND created_at >= $2 AND created_at < $3"
	if archived != nil {
		args = append(args, *archived)
		where += fmt.Sprintf(" AND is_archived = $%d", len(args))
	}
	return collectMemos(s.pool.Query(ctx,
		"SELECT "+memoColumns+" FROM memos WHERE "+where+" ORDER BY created_at DESC", args...))
}

// Search filters memos by keyword, tags, archive state and creation window.
func (s *MemoStore) Search(
	ctx context.Context,
	userID uuid.UUID,
	query domain.MemoSearchQuery,
	fromMS, toMS *int64,
	offset uint32,
) ([]domain.Memo, int64, error) {
	args := []any{userID}
	conditions := []string{}

	if query.Query != "" {
		args = append(args, "%"+query.Query+"%")
		conditions = append(conditions, fmt.Sprintf(
			"(content ILIKE $%d OR tags::text ILIKE $%d)", len(args), len(args)))
	}
	if query.IsArchived != nil {
		args = append(args, *query.IsArchived)
		conditions = append(conditions, fmt.Sprintf("is_archived = $%d", len(args)))
	}
	if len(query.Tags) > 0 {
		args = append(args, query.Tags)
		conditions = append(conditions, fmt.Sprintf("tags ?& $%d::text[]", len(args)))
	}
	if fromMS != nil {
		args = append(args, *fromMS)
		conditions = append(conditions, fmt.Sprintf("created_at >= $%d", len(args)))
	}
	if toMS != nil {
		args = append(args, *toMS)
		conditions = append(conditions, fmt.Sprintf("created_at < $%d", len(args)))
	}

	where := "user_id = $1 AND is_deleted = false"
	if len(conditions) > 0 {
		where += " AND " + strings.Join(conditions, " AND ")
	}

	total, err := countMemos(ctx, s.pool, where, args)
	if err != nil {
		return nil, 0, err
	}

	args = append(args, int64(query.PageSize), int64(offset))
	sql := fmt.Sprintf("SELECT %s FROM memos WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		memoColumns, where, len(args)-1, len(args))

	memos, err := collectMemos(s.pool.Query(ctx, sql, args...))
	if err != nil {
		return nil, 0, err
	}
	return memos, total, nil
}

// TagCounts counts the memos carrying each tag, in tag order.
func (s *MemoStore) TagCounts(ctx context.Context, userID uuid.UUID) ([]domain.TagCount, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT tag, COUNT(*)::bigint AS count
		 FROM memos, jsonb_array_elements_text(tags) AS tag
		 WHERE user_id = $1 AND is_deleted = false
		 GROUP BY tag
		 ORDER BY tag ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := []domain.TagCount{}
	for rows.Next() {
		var count domain.TagCount
		if err := rows.Scan(&count.Tag, &count.Count); err != nil {
			return nil, err
		}
		counts = append(counts, count)
	}
	return counts, rows.Err()
}

// Revisions returns a memo's live history, oldest first. The join enforces
// ownership so a caller can never read another user's revisions.
func (s *MemoStore) Revisions(ctx context.Context, userID, memoID uuid.UUID) ([]domain.MemoRevision, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT r.id, r.memo_id, r.user_id, r.revision_number, r.content, r.tags,
			r.ai_summary, r.is_deleted, r.created_at
		 FROM memo_revisions r
		 JOIN memos m ON m.id = r.memo_id
		 WHERE r.memo_id = $1 AND m.user_id = $2 AND r.is_deleted = false
		 ORDER BY r.revision_number ASC`, memoID, userID)
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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return revisions, nil
}

// DeleteRevision soft-deletes one revision. The memo row is locked first so two
// concurrent deletes cannot both observe more than one revision and delete the
// last two. revision_count is deliberately not decremented: it tracks the
// highest-ever revision number so future allocations stay collision-free.
func (s *MemoStore) DeleteRevision(
	ctx context.Context,
	userID, memoID, revisionID uuid.UUID,
	now int64,
) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var locked uuid.UUID
	err = tx.QueryRow(ctx,
		`SELECT id FROM memos WHERE id = $1 AND user_id = $2 FOR UPDATE`,
		memoID, userID).Scan(&locked)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrNoRows
	}
	if err != nil {
		return err
	}

	var active int64
	if err := tx.QueryRow(ctx,
		`SELECT COUNT(*) FROM memo_revisions WHERE memo_id = $1 AND is_deleted = false`,
		memoID).Scan(&active); err != nil {
		return err
	}
	if err := EnsureRevisionDeletable(active); err != nil {
		return err
	}

	tag, err := tx.Exec(ctx,
		`UPDATE memo_revisions SET is_deleted = true
		 WHERE id = $1 AND memo_id = $2 AND user_id = $3`,
		revisionID, memoID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNoRows
	}

	if _, err := tx.Exec(ctx,
		`UPDATE memos SET updated_at = GREATEST($1, updated_at + 1) WHERE id = $2`,
		now, memoID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
