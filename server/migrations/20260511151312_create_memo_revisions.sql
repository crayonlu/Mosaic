-- Add migration script here

CREATE TABLE IF NOT EXISTS memo_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id UUID NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]',
  ai_summary TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at BIGINT NOT NULL
);

CREATE INDEX idx_memo_revisions_memo ON memo_revisions(memo_id, revision_number);
CREATE INDEX idx_memo_revisions_user_date ON memo_revisions(user_id, created_at DESC);
CREATE UNIQUE INDEX idx_memo_revisions_unique ON memo_revisions(memo_id, revision_number);
