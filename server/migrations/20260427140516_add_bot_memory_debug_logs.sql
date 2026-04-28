CREATE TABLE IF NOT EXISTS bot_memory_debug_logs (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	memo_id UUID NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
	bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
	mode VARCHAR(20) NOT NULL,
	retrieved_memo_ids JSONB NOT NULL DEFAULT '[]',
	selected_episode_ids JSONB NOT NULL DEFAULT '[]',
	score_payload JSONB NOT NULL DEFAULT '{}',
	prompt_size INTEGER NOT NULL DEFAULT 0,
	created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bot_memory_debug_logs_user_id ON bot_memory_debug_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_memory_debug_logs_memo_id ON bot_memory_debug_logs(memo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_memory_debug_logs_bot_id ON bot_memory_debug_logs(bot_id, created_at DESC);
