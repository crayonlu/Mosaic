-- Add revision_number column to bot_replies
ALTER TABLE bot_replies ADD COLUMN IF NOT EXISTS revision_number INTEGER;
