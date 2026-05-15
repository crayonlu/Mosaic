-- Add migration script here

INSERT INTO memo_revisions (id, memo_id, user_id, revision_number, content, tags, ai_summary, is_deleted, created_at)
SELECT gen_random_uuid(), m.id, m.user_id, 1, m.content, m.tags, m.ai_summary, m.is_deleted, m.created_at
FROM memos m
WHERE NOT EXISTS (
  SELECT 1 FROM memo_revisions r WHERE r.memo_id = m.id
);
