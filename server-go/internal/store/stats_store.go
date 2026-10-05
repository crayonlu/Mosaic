package store

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// StatsStore reads the aggregates behind the stats screens.
type StatsStore struct {
	pool *pgxpool.Pool
}

func NewStatsStore(pool *pgxpool.Pool) *StatsStore {
	return &StatsStore{pool: pool}
}

// DiariesInRange returns the diary fields the heat map and timeline need.
func (s *StatsStore) DiariesInRange(
	ctx context.Context,
	userID uuid.UUID,
	start, end domain.Date,
) ([]domain.Diary, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT date, summary, mood_key, mood_score
		 FROM diaries
		 WHERE user_id = $1 AND date BETWEEN $2 AND $3
		 ORDER BY date`,
		userID, start.Time, end.Time)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	diaries := []domain.Diary{}
	for rows.Next() {
		var (
			date  time.Time
			diary domain.Diary
		)
		if err := rows.Scan(&date, &diary.Summary, &diary.MoodKey, &diary.MoodScore); err != nil {
			return nil, err
		}
		diary.Date = domain.NewDate(date)
		diary.UserID = userID
		diaries = append(diaries, diary)
	}
	return diaries, rows.Err()
}

// MemoTimestamps returns the creation times of live memos in a millisecond window.
func (s *StatsStore) MemoTimestamps(
	ctx context.Context,
	userID uuid.UUID,
	startMs, endMs int64,
) ([]int64, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT created_at FROM memos
		 WHERE user_id = $1 AND is_deleted = false AND created_at >= $2 AND created_at < $3`,
		userID, startMs, endMs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	timestamps := []int64{}
	for rows.Next() {
		var ts int64
		if err := rows.Scan(&ts); err != nil {
			return nil, err
		}
		timestamps = append(timestamps, ts)
	}
	return timestamps, rows.Err()
}

// MemosInRange returns live memos in a millisecond window, newest first.
func (s *StatsStore) MemosInRange(
	ctx context.Context,
	userID uuid.UUID,
	startMs, endMs int64,
) ([]domain.Memo, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date,
		        ai_summary, created_at, updated_at, revision_count
		 FROM memos
		 WHERE user_id = $1 AND is_deleted = false AND created_at >= $2 AND created_at < $3
		 ORDER BY created_at DESC`,
		userID, startMs, endMs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	memos := []domain.Memo{}
	for rows.Next() {
		memo, err := scanStatsMemo(rows)
		if err != nil {
			return nil, err
		}
		memos = append(memos, memo)
	}
	return memos, rows.Err()
}

func scanStatsMemo(row pgx.Row) (domain.Memo, error) {
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
	if err != nil {
		return domain.Memo{}, err
	}
	memo.Tags = domain.TagListFromJSON(tags)
	if diaryDate != nil {
		parsed := domain.NewDate(*diaryDate)
		memo.DiaryDate = &parsed
	}
	return memo, nil
}

// MoodCounts counts diaries per mood key in a date window.
func (s *StatsStore) MoodCounts(
	ctx context.Context,
	userID uuid.UUID,
	start, end domain.Date,
) ([]domain.MoodData, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT mood_key, COUNT(*) FROM diaries
		 WHERE user_id = $1 AND date BETWEEN $2 AND $3
		 GROUP BY mood_key`,
		userID, start.Time, end.Time)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	moods := []domain.MoodData{}
	for rows.Next() {
		var (
			mood  domain.MoodData
			count int64
		)
		if err := rows.Scan(&mood.MoodKey, &count); err != nil {
			return nil, err
		}
		mood.Count = int32(count)
		moods = append(moods, mood)
	}
	return moods, rows.Err()
}

// TagCounts returns the twenty most-used tags on live memos in a millisecond
// window.
func (s *StatsStore) TagCounts(
	ctx context.Context,
	userID uuid.UUID,
	startMs, endMs int64,
) ([]domain.TagData, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT jsonb_array_elements_text(tags) AS tag, COUNT(*) AS count
		 FROM memos
		 WHERE user_id = $1 AND is_deleted = false AND created_at >= $2 AND created_at < $3
		 GROUP BY tag
		 ORDER BY count DESC
		 LIMIT 20`,
		userID, startMs, endMs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tags := []domain.TagData{}
	for rows.Next() {
		var (
			tag   *string
			count int64
		)
		if err := rows.Scan(&tag, &count); err != nil {
			return nil, err
		}
		entry := domain.TagData{Count: int32(count)}
		if tag != nil {
			entry.Tag = *tag
		}
		tags = append(tags, entry)
	}
	return tags, rows.Err()
}

// SummaryTotals returns the month's memo, diary, and resource counts.
func (s *StatsStore) SummaryTotals(
	ctx context.Context,
	userID uuid.UUID,
	year, month int32,
	startMs, endMs int64,
) (int64, int64, int64, error) {
	var memos int64
	err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM memos
		 WHERE user_id = $1 AND is_deleted = false AND created_at >= $2 AND created_at < $3`,
		userID, startMs, endMs).Scan(&memos)
	if err != nil {
		return 0, 0, 0, err
	}

	var diaries int64
	err = s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM diaries
		 WHERE user_id = $1
		   AND EXTRACT(YEAR FROM date) = $2
		   AND EXTRACT(MONTH FROM date) = $3`,
		userID, year, month).Scan(&diaries)
	if err != nil {
		return 0, 0, 0, err
	}

	var resources int64
	err = s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM resources r
		 JOIN memos m ON r.memo_id = m.id
		 WHERE m.user_id = $1 AND r.is_deleted = FALSE
		   AND r.created_at >= $2 AND r.created_at < $3`,
		userID, startMs, endMs).Scan(&resources)
	if err != nil {
		return 0, 0, 0, err
	}

	return memos, diaries, resources, nil
}
