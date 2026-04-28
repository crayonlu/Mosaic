CREATE TABLE IF NOT EXISTS server_ai_configs (
	key VARCHAR(100) PRIMARY KEY,
	provider VARCHAR(50) NOT NULL,
	base_url VARCHAR(500) NOT NULL,
	api_key TEXT NOT NULL,
	model VARCHAR(200) NOT NULL,
	temperature DOUBLE PRECISION,
	max_tokens INTEGER,
	timeout_seconds INTEGER,
	updated_at BIGINT NOT NULL
);

INSERT INTO server_ai_configs (key, provider, base_url, api_key, model, temperature, max_tokens, timeout_seconds, updated_at)
VALUES
	('bot', 'openai', 'https://api.openai.com', '', '', NULL, NULL, NULL, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
	('embedding', 'openai', 'https://api.openai.com', '', '', NULL, NULL, NULL, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
ON CONFLICT (key) DO NOTHING;
