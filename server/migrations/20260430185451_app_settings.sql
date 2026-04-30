CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at BIGINT NOT NULL
);

INSERT INTO app_settings (key, value, updated_at) VALUES
    ('auto_tag_enabled', 'true', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
    ('auto_summary_enabled', 'false', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
ON CONFLICT DO NOTHING;
