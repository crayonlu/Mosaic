-- Drop the vestigial embedding columns from user_ai_configs.
-- Embedding config is global (server_ai_configs "embedding") because pgvector
-- requires a single fixed dimension; per-user embedding_model/embedding_dim
-- were never populated by any client and are no longer referenced by the server.
-- Idempotent.

ALTER TABLE user_ai_configs DROP COLUMN IF EXISTS embedding_model;
ALTER TABLE user_ai_configs DROP COLUMN IF EXISTS embedding_dim;
