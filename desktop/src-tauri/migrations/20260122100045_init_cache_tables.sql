-- Create cache tables for offline storage

CREATE TABLE IF NOT EXISTS cached_memos (
    id TEXT PRIMARY KEY NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    is_archived INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    diary_date TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    synced_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cached_memos_updated ON cached_memos(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cached_memos_archived ON cached_memos(is_archived, is_deleted, updated_at DESC);

CREATE TABLE IF NOT EXISTS cached_diaries (
    date TEXT PRIMARY KEY NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    mood_key TEXT NOT NULL DEFAULT 'neutral',
    mood_score INTEGER NOT NULL DEFAULT 50,
    cover_image_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    synced_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cached_diaries_date ON cached_diaries(date DESC);

CREATE TABLE IF NOT EXISTS offline_operations (
    id TEXT PRIMARY KEY NOT NULL,
    operation_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    retried_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_offline_ops_created ON offline_operations(created_at ASC);

CREATE TABLE IF NOT EXISTS cached_resources (
    id TEXT PRIMARY KEY NOT NULL,
    memo_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    resource_type TEXT NOT NULL CHECK(resource_type IN ('image', 'video')),
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    storage_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    local_path TEXT,
    created_at INTEGER NOT NULL,
    synced_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cached_resources_memo ON cached_resources(memo_id);
CREATE INDEX IF NOT EXISTS idx_cached_resources_synced ON cached_resources(synced_at DESC);
