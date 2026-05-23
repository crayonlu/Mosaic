-- Add user_id column to resources table (denormalize for sync performance)
-- The sync pull query for resources filters by user via JOIN with memos or
-- storage_path pattern. Adding a direct user_id avoids the JOIN and enables
-- a composite index for efficient sync pulls.

ALTER TABLE resources ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- Backfill user_id for resources linked to memos
UPDATE resources r
SET user_id = m.user_id
FROM memos m
WHERE r.memo_id = m.id AND r.user_id IS NULL;

-- Backfill user_id for orphan resources (no memo_id) via storage_path pattern: resources/{user_uuid}/...
UPDATE resources r
SET user_id = CAST(SPLIT_PART(r.storage_path, '/', 2) AS UUID)
WHERE r.memo_id IS NULL AND r.user_id IS NULL
  AND r.storage_path LIKE 'resources/%/%';

-- Now make it NOT NULL and create the composite index
ALTER TABLE resources ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_resources_user_updated
    ON resources(user_id, updated_at ASC);
