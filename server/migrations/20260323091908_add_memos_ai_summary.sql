-- Add migration script here
-- Add AI summary column to memos table
-- This stores the AI-generated summary for each memo

ALTER TABLE memos ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- Create index for faster queries on ai_summary (when not null)
CREATE INDEX IF NOT EXISTS idx_memos_ai_summary ON memos(user_id) WHERE ai_summary IS NOT NULL;