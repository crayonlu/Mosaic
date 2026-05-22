-- Add performance indexes for common query patterns

-- For list_memos date range queries (filtering by user + ordering by created_at)
CREATE INDEX IF NOT EXISTS idx_memos_user_created
    ON memos(user_id, created_at DESC);

-- For archive-filtered lists (filtering by user + archive status, excluding deleted)
CREATE INDEX IF NOT EXISTS idx_memos_user_archived
    ON memos(user_id, is_archived)
    WHERE is_deleted = false;

-- For batch resource lookup by memo (excluding deleted resources)
CREATE INDEX IF NOT EXISTS idx_resources_memo_id
    ON resources(memo_id)
    WHERE is_deleted = false;

-- For sync pull queries (looking up cursors by user + entity type)
CREATE INDEX IF NOT EXISTS idx_sync_cursors_user
    ON sync_cursors(user_id, entity_type);

-- For diary lookup queries (finding diaries by user + date)
CREATE INDEX IF NOT EXISTS idx_diaries_user_date
    ON diaries(user_id, date);
