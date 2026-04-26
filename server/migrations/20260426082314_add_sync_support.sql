-- Add migration script here
-- Add sync_cursors table for tracking client sync progress
CREATE TABLE IF NOT EXISTS sync_cursors (
    client_id   VARCHAR(64) NOT NULL,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type VARCHAR(32) NOT NULL,
    last_sync_at BIGINT NOT NULL,
    created_at  BIGINT NOT NULL,
    updated_at  BIGINT NOT NULL,
    PRIMARY KEY (client_id, user_id, entity_type)
);

-- Add is_deleted and updated_at to resources for soft delete sync support
ALTER TABLE resources ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS updated_at BIGINT NOT NULL DEFAULT 0;

-- Update existing resources to have updated_at = created_at
UPDATE resources SET updated_at = created_at WHERE updated_at = 0;

-- Add is_deleted to diaries for sync support
ALTER TABLE diaries ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- Add is_deleted to bots for sync support
ALTER TABLE bots ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- Change resources delete to soft delete: add index for sync queries
CREATE INDEX IF NOT EXISTS idx_resources_sync ON resources(user_id, updated_at) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_diaries_sync ON diaries(user_id, updated_at) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_bots_sync ON bots(user_id, updated_at) WHERE is_deleted = FALSE;
