-- Add indexes for sync system queries (filtering by user + updated_at)
-- The sync pull queries use: WHERE user_id = $1 AND updated_at > $2 ORDER BY updated_at ASC

CREATE INDEX IF NOT EXISTS idx_memos_user_updated
    ON memos(user_id, updated_at ASC);

CREATE INDEX IF NOT EXISTS idx_diaries_user_updated
    ON diaries(user_id, updated_at ASC);

CREATE INDEX IF NOT EXISTS idx_resources_user_updated
    ON resources(user_id, updated_at ASC);
