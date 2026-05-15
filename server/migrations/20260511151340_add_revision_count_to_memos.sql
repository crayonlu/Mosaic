-- Add migration script here
ALTER TABLE memos ADD COLUMN revision_count INTEGER NOT NULL DEFAULT 1;
