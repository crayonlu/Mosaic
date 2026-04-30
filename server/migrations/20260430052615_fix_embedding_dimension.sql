-- Drop fixed-dimension index (ivfflat requires a specific dimension)
DROP INDEX IF EXISTS idx_memo_embeddings_embedding;

-- Clear stale embeddings (wrong dimension - backfill will re-index them)
DELETE FROM memo_embeddings;

-- Replace fixed-dimension column with dimension-agnostic one
ALTER TABLE memo_embeddings DROP COLUMN embedding;
ALTER TABLE memo_embeddings ADD COLUMN embedding vector NOT NULL;
