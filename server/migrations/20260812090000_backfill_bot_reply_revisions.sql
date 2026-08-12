-- Older bot replies were inserted without a revision_number. First recover
-- root replies from the memo revision that existed when the reply was made.
UPDATE bot_replies AS reply
SET revision_number = COALESCE(
    (
        SELECT MAX(revision_number)
        FROM memo_revisions
        WHERE memo_id = reply.memo_id
          AND created_at <= reply.created_at
    ),
    (
        SELECT revision_count
        FROM memos
        WHERE id = reply.memo_id
    ),
    1
)
WHERE reply.parent_reply_id IS NULL
  AND reply.revision_number IS NULL;

-- Then recover manual descendants from their root auto-reply so the API cannot
-- show a reply on every memo revision.
WITH RECURSIVE reply_tree AS (
    SELECT id, id AS root_id, revision_number
    FROM bot_replies
    WHERE parent_reply_id IS NULL

    UNION

    SELECT child.id, tree.root_id, tree.revision_number
    FROM bot_replies child
    JOIN reply_tree tree ON child.parent_reply_id = tree.id
)
UPDATE bot_replies AS reply
SET revision_number = tree.revision_number
FROM reply_tree AS tree
WHERE reply.id = tree.id
  AND reply.revision_number IS NULL
  AND tree.revision_number IS NOT NULL;
