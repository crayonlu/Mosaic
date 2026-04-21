CREATE TABLE bots (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    avatar_url  VARCHAR(500),
    description TEXT NOT NULL DEFAULT '',
    tags        JSONB NOT NULL DEFAULT '[]',
    auto_reply  BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  BIGINT NOT NULL,
    updated_at  BIGINT NOT NULL
);

CREATE INDEX idx_bots_user_id ON bots(user_id);

CREATE TABLE bot_replies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memo_id         UUID NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
    bot_id          UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    parent_reply_id UUID REFERENCES bot_replies(id) ON DELETE CASCADE,
    user_question   TEXT,
    created_at      BIGINT NOT NULL
);

CREATE INDEX idx_bot_replies_memo_id ON bot_replies(memo_id);
CREATE INDEX idx_bot_replies_parent_id ON bot_replies(parent_reply_id);
