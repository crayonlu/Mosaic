// ============================================================================
// Migration SQL Statements
// ============================================================================

export const MIGRATION_V1 = `
-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- diaries table
CREATE TABLE IF NOT EXISTS diaries (
  date TEXT PRIMARY KEY NOT NULL,

  -- Summary of the day
  summary TEXT NOT NULL DEFAULT '',

  -- Mood of the day
  mood_key TEXT NOT NULL,
  -- emotional concentration
  mood_score INTEGER NOT NULL DEFAULT 50,

  -- cover image(optional)
  cover_image_id TEXT,
  -- memo count(that day contains how many memos)
  memo_count INTEGER NOT NULL DEFAULT 0,

  -- created at(ms)
  created_at INTEGER NOT NULL,
  -- updated at(ms)(for sync)
  updated_at INTEGER NOT NULL
);

-- memos table
CREATE TABLE IF NOT EXISTS memos (
  id TEXT PRIMARY KEY NOT NULL,

  -- content of memo
  content TEXT NOT NULL DEFAULT '',
  -- tags
  tags TEXT NOT NULL DEFAULT '[]',

  -- is archived
  is_archived BOOLEAN NOT NULL DEFAULT 0,
  -- is deleted
  is_deleted BOOLEAN NOT NULL DEFAULT 0,

  diary_date TEXT,

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- resources table
CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY NOT NULL,
  memo_id TEXT NOT NULL,

  filename TEXT NOT NULL,
  -- 'image', 'voice', 'video'
  resource_type TEXT NOT NULL,
  -- 'image/webp', 'audio/mp4'(for frontend display)
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,

  created_at INTEGER NOT NULL,
  FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memos_inbox ON memos(is_archived, is_deleted, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resources_memo ON resources(memo_id);
`

export const MIGRATION_V2 = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL DEFAULT 'new user',
  avatar_path TEXT,
  avatar_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`

export const MIGRATION_V3 = `
-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- settings table
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY NOT NULL,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
`
