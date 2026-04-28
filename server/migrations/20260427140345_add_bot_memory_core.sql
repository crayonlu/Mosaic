CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS memo_embeddings (
	memo_id UUID PRIMARY KEY REFERENCES memos(id) ON DELETE CASCADE,
	source_text TEXT NOT NULL,
	provider VARCHAR(50) NOT NULL,
	model VARCHAR(100) NOT NULL,
	embedding vector(1536) NOT NULL,
	updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS memo_episodes (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	title VARCHAR(200) NOT NULL,
	status VARCHAR(20) NOT NULL,
	summary TEXT NOT NULL DEFAULT '',
	keywords JSONB NOT NULL DEFAULT '[]',
	last_memo_id UUID REFERENCES memos(id) ON DELETE SET NULL,
	start_at BIGINT NOT NULL,
	end_at BIGINT,
	updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS memo_episode_links (
	episode_id UUID NOT NULL REFERENCES memo_episodes(id) ON DELETE CASCADE,
	memo_id UUID NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
	event_at BIGINT NOT NULL,
	relevance_score DOUBLE PRECISION NOT NULL DEFAULT 0,
	created_at BIGINT NOT NULL,
	PRIMARY KEY (episode_id, memo_id)
);

CREATE TABLE IF NOT EXISTS user_memory_profiles (
	user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
	profile_summary TEXT NOT NULL DEFAULT '',
	topic_signals JSONB NOT NULL DEFAULT '[]',
	mood_patterns JSONB NOT NULL DEFAULT '[]',
	updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memo_episodes_user_id ON memo_episodes(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_memo_episodes_last_memo_id ON memo_episodes(last_memo_id);
CREATE INDEX IF NOT EXISTS idx_memo_episode_links_memo_id ON memo_episode_links(memo_id, event_at DESC);
CREATE INDEX IF NOT EXISTS idx_memo_episode_links_episode_id ON memo_episode_links(episode_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_memo_embeddings_updated_at ON memo_embeddings(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_memo_embeddings_embedding ON memo_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
