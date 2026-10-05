package store

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// AIDiaryStore reads and writes the ai_diary_jobs queue and the diaries a
// generator produces.
type AIDiaryStore struct {
	pool *pgxpool.Pool
}

func NewAIDiaryStore(pool *pgxpool.Pool) *AIDiaryStore {
	return &AIDiaryStore{pool: pool}
}

// EnqueueJob schedules a day's diary generation. An existing completed job is
// left completed so a memo added after the fact cannot reopen it; otherwise the
// job is reset to pending with its error cleared, matching the previous server.
func (s *AIDiaryStore) EnqueueJob(
	ctx context.Context,
	userID uuid.UUID,
	targetDate domain.Date,
	runAfterMS, now int64,
) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO ai_diary_jobs
		     (user_id, target_date, run_after_ms, status, last_error, created_at, updated_at)
		 VALUES ($1, $2, $3, 'pending', NULL, $4, $4)
		 ON CONFLICT (user_id, target_date)
		 DO UPDATE SET run_after_ms = EXCLUDED.run_after_ms,
		               status = CASE WHEN ai_diary_jobs.status = 'completed'
		                             THEN ai_diary_jobs.status ELSE 'pending' END,
		               last_error = NULL,
		               updated_at = EXCLUDED.updated_at`,
		userID, diaryDateValue(targetDate), runAfterMS, now)
	return err
}

// ClaimDueJobs atomically marks up to limit due jobs running and returns them.
// FOR UPDATE SKIP LOCKED lets concurrent sweepers take disjoint batches.
func (s *AIDiaryStore) ClaimDueJobs(
	ctx context.Context,
	now int64,
	limit int,
) ([]service.AIDiaryJob, error) {
	rows, err := s.pool.Query(ctx,
		`WITH due AS (
		     SELECT user_id, target_date
		     FROM ai_diary_jobs
		     WHERE status = 'pending' AND run_after_ms <= $1
		     ORDER BY run_after_ms ASC
		     LIMIT $2
		     FOR UPDATE SKIP LOCKED
		 )
		 UPDATE ai_diary_jobs AS jobs
		 SET status = 'running', updated_at = $1, last_error = NULL
		 FROM due
		 WHERE jobs.user_id = due.user_id AND jobs.target_date = due.target_date
		 RETURNING jobs.user_id, jobs.target_date`,
		now, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	jobs := []service.AIDiaryJob{}
	for rows.Next() {
		var (
			userID uuid.UUID
			date   time.Time
		)
		if err := rows.Scan(&userID, &date); err != nil {
			return nil, err
		}
		jobs = append(jobs, service.AIDiaryJob{UserID: userID, TargetDate: domain.NewDate(date)})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return jobs, nil
}

// CompleteJob marks a job done and clears its error.
func (s *AIDiaryStore) CompleteJob(
	ctx context.Context,
	userID uuid.UUID,
	targetDate domain.Date,
	now int64,
) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE ai_diary_jobs
		 SET status = 'completed', last_error = NULL, updated_at = $3
		 WHERE user_id = $1 AND target_date = $2`,
		userID, diaryDateValue(targetDate), now)
	return err
}

// FailJob returns a job to pending with its last error and a new run time.
func (s *AIDiaryStore) FailJob(
	ctx context.Context,
	userID uuid.UUID,
	targetDate domain.Date,
	lastError string,
	runAfterMS, now int64,
) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE ai_diary_jobs
		 SET status = 'pending',
		     last_error = $3,
		     run_after_ms = $4,
		     updated_at = $5
		 WHERE user_id = $1 AND target_date = $2`,
		userID, diaryDateValue(targetDate), lastError, runAfterMS, now)
	return err
}

// DiaryForDate returns a day's diary, or domain.ErrNoRows when none exists.
func (s *AIDiaryStore) DiaryForDate(
	ctx context.Context,
	userID uuid.UUID,
	targetDate domain.Date,
) (domain.Diary, error) {
	return scanDiary(s.pool.QueryRow(ctx,
		`SELECT `+diaryColumns+` FROM diaries WHERE user_id = $1 AND date = $2`,
		userID, diaryDateValue(targetDate)))
}

// CandidateMemos returns the live, unarchived memos created inside the window,
// oldest first — the material a diary can be generated from.
func (s *AIDiaryStore) CandidateMemos(
	ctx context.Context,
	userID uuid.UUID,
	startMS, endMS int64,
) ([]domain.Memo, error) {
	return collectMemos(s.pool.Query(ctx,
		`SELECT `+memoColumns+` FROM memos
		 WHERE user_id = $1
		   AND is_deleted = false
		   AND is_archived = false
		   AND created_at >= $2
		   AND created_at < $3
		 ORDER BY created_at ASC`,
		userID, startMS, endMS))
}

// SaveGeneratedDiary writes an auto-generated diary and archives the memos it
// was built from, in one transaction. The diary upsert is guarded so a diary
// the user has edited is never overwritten.
func (s *AIDiaryStore) SaveGeneratedDiary(
	ctx context.Context,
	userID uuid.UUID,
	targetDate domain.Date,
	summary, moodKey string,
	moodScore int32,
	memoIDs []uuid.UUID,
	now int64,
) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx,
		`INSERT INTO diaries (
		     date, user_id, summary, mood_key, mood_score,
		     generation_source, auto_generation_locked, generated_from_memo_ids,
		     last_auto_generated_at, created_at, updated_at
		 )
		 VALUES ($1, $2, $3, $4, $5, $6, false, $7::jsonb, $8, $8, $8)
		 ON CONFLICT (date)
		 DO UPDATE SET summary = EXCLUDED.summary,
		               mood_key = EXCLUDED.mood_key,
		               mood_score = EXCLUDED.mood_score,
		               generation_source = EXCLUDED.generation_source,
		               auto_generation_locked = false,
		               generated_from_memo_ids = EXCLUDED.generated_from_memo_ids,
		               last_auto_generated_at = EXCLUDED.last_auto_generated_at,
		               updated_at = EXCLUDED.updated_at
		 WHERE diaries.user_id = EXCLUDED.user_id
		   AND diaries.auto_generation_locked = false`,
		diaryDateValue(targetDate), userID, summary, moodKey, moodScore,
		domain.GenerationSourceAI, marshalUUIDList(memoIDs), now); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx,
		`UPDATE memos
		 SET is_archived = true, diary_date = $1, updated_at = $2
		 WHERE user_id = $3 AND id = ANY($4) AND is_deleted = false AND is_archived = false`,
		diaryDateValue(targetDate), now, userID, memoIDs); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
