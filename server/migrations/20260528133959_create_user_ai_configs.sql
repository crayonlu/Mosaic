-- Per-user AI configuration table
CREATE TABLE user_ai_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    base_url TEXT NOT NULL DEFAULT '',
    api_key TEXT NOT NULL,
    model VARCHAR(100) NOT NULL,
    temperature FLOAT8,
    max_tokens INTEGER DEFAULT 4096,
    timeout_seconds INTEGER DEFAULT 60,
    supports_vision BOOLEAN NOT NULL DEFAULT false,
    supports_thinking BOOLEAN NOT NULL DEFAULT false,
    embedding_model VARCHAR(100),
    embedding_dim INTEGER,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    UNIQUE(user_id)
);

CREATE INDEX idx_user_ai_configs_user_id ON user_ai_configs(user_id);
