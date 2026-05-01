ALTER TABLE diaries
    ADD COLUMN IF NOT EXISTS generation_source VARCHAR(20) NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS auto_generation_locked BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS generated_from_memo_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS last_auto_generated_at BIGINT;

UPDATE diaries
SET generation_source = 'manual',
    auto_generation_locked = TRUE,
    generated_from_memo_ids = COALESCE(generated_from_memo_ids, '[]'::jsonb)
WHERE generation_source IS DISTINCT FROM 'manual'
   OR auto_generation_locked IS DISTINCT FROM TRUE
   OR generated_from_memo_ids IS NULL;

CREATE TABLE IF NOT EXISTS ai_diary_jobs (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_date DATE NOT NULL,
    run_after_ms BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    last_error TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, target_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_diary_jobs_pending
ON ai_diary_jobs (status, run_after_ms);
