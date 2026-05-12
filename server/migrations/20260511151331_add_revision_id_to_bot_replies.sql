-- Add migration script here
ALTER TABLE bot_replies ADD COLUMN IF NOT EXISTS revision_number INTEGER;
