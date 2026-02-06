-- Add migration script here
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(500),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]',
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  diary_date DATE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memos_user ON memos(user_id, is_deleted, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memos_diary_date ON memos(diary_date);

CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id UUID REFERENCES memos(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  resource_type VARCHAR(20) NOT NULL DEFAULT 'image' CHECK(resource_type IN ('image', 'video')),
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  storage_type VARCHAR(20) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resources_memo ON resources(memo_id);

CREATE TABLE IF NOT EXISTS diaries (
  date DATE PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  mood_key VARCHAR(50) NOT NULL,
  mood_score INTEGER NOT NULL DEFAULT 50,
  cover_image_id UUID REFERENCES resources(id),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_diaries_user ON diaries(user_id, date DESC);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
