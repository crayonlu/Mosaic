package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// BotReplyReader reads the replies a bot produced for a memo. The bot module
// owns the write side; the memo detail endpoint only needs to read them.
type BotReplyReader struct {
	pool *pgxpool.Pool
}

func NewBotReplyReader(pool *pgxpool.Pool) *BotReplyReader {
	return &BotReplyReader{pool: pool}
}

// RepliesForMemo returns a memo's bot replies, oldest first. Replies are only
// visible to the owner of the memo they hang off.
func (r *BotReplyReader) RepliesForMemo(
	ctx context.Context,
	userID, memoID uuid.UUID,
) ([]domain.BotReply, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT br.id, br.memo_id, br.bot_id, br.content, br.thinking_content,
		        br.parent_reply_id, br.user_question, br.revision_number, br.created_at
		 FROM bot_replies br
		 JOIN memos m ON m.id = br.memo_id
		 WHERE br.memo_id = $1 AND m.user_id = $2
		 ORDER BY br.created_at ASC`, memoID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var replies []domain.BotReply
	for rows.Next() {
		var reply domain.BotReply
		if err := rows.Scan(
			&reply.ID,
			&reply.MemoID,
			&reply.BotID,
			&reply.Content,
			&reply.ThinkingContent,
			&reply.ParentReplyID,
			&reply.UserQuestion,
			&reply.RevisionNumber,
			&reply.CreatedAt,
		); err != nil {
			return nil, err
		}
		replies = append(replies, reply)
	}
	return replies, rows.Err()
}
