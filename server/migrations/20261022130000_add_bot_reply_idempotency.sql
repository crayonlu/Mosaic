-- Client-generated request identity for bot follow-ups. A repeated request with
-- the same client_request_id must return the existing row instead of starting a
-- second generation.
ALTER TABLE bot_replies
    ADD COLUMN client_request_id UUID,
    ADD COLUMN status TEXT NOT NULL DEFAULT 'completed',
    ADD COLUMN error_message TEXT,
    ADD COLUMN claim_version INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN updated_at BIGINT NOT NULL DEFAULT 0;

UPDATE bot_replies SET updated_at = created_at;

ALTER TABLE bot_replies
    ADD CONSTRAINT bot_replies_status_check
    CHECK (status IN ('pending', 'completed', 'failed'));

CREATE UNIQUE INDEX idx_bot_replies_client_request_id
    ON bot_replies(client_request_id);

CREATE INDEX idx_bot_replies_pending
    ON bot_replies(status, updated_at)
    WHERE status = 'pending';
