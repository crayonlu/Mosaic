INSERT INTO app_settings (key, value, updated_at)
VALUES ('app_timezone', 'Asia/Shanghai', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
ON CONFLICT DO NOTHING;
