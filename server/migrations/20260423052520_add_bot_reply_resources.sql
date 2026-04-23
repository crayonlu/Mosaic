-- Add migration script here
CREATE TABLE IF NOT EXISTS bot_reply_resources (
    reply_id    UUID NOT NULL REFERENCES bot_replies(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  BIGINT NOT NULL,
    PRIMARY KEY (reply_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_bot_reply_resources_reply_id ON bot_reply_resources(reply_id);
