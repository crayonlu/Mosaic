CREATE INDEX IF NOT EXISTS idx_memo_embeddings_embedding
ON memo_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
