-- Migrate the global server_ai_configs "bot" row into per-user user_ai_configs.
-- Per the new design, each user configures their own chat-model AI config;
-- the memo auto-flow (bot replies / auto-tag / auto-summary), AI diary, clip,
-- resource AI description, and /api/ai routes all read user_ai_configs.
-- Embedding stays global (server_ai_configs "embedding") because pgvector
-- requires a single fixed dimension.
--
-- Idempotent: only inserts a per-user row for users that don't already have one,
-- and only deletes the global "bot" row if it exists. Safe to re-run.

-- 1. Seed each user's user_ai_configs from the global "bot" config.
--    Users who already have a row are left untouched.
INSERT INTO user_ai_configs (
    user_id, provider, base_url, api_key, model,
    temperature, max_tokens, timeout_seconds,
    supports_vision, supports_thinking, created_at, updated_at
)
SELECT
    u.id,
    c.provider,
    c.base_url,
    c.api_key,
    c.model,
    c.temperature,
    c.max_tokens,
    c.timeout_seconds,
    c.supports_vision,
    c.supports_thinking,
    EXTRACT(epoch FROM NOW())::bigint,
    EXTRACT(epoch FROM NOW())::bigint
FROM users AS u
CROSS JOIN
    LATERAL(
        SELECT * FROM server_ai_configs
        WHERE key = 'bot' LIMIT 1
    ) AS c
WHERE NOT EXISTS (
    SELECT 1 FROM user_ai_configs AS uac
    WHERE uac.user_id = u.id
);

-- 2. Drop the now-unused global "bot" config. Embedding config is retained.
DELETE FROM server_ai_configs
WHERE key = 'bot';
