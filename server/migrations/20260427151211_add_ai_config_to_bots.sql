-- Add AI configuration fields to bots table
ALTER TABLE bots ADD COLUMN IF NOT EXISTS model VARCHAR(255);
ALTER TABLE bots ADD COLUMN IF NOT EXISTS ai_config JSONB;
