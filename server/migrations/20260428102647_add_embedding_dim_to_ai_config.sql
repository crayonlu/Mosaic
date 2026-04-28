ALTER TABLE server_ai_configs
ADD COLUMN IF NOT EXISTS embedding_dim INTEGER;
