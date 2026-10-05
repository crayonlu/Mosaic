package service

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

type threadKey struct {
	MemoID      uuid.UUID
	BotID       uuid.UUID
	Revision    int32
	HasRevision bool
}

func keyFor(reply domain.BotReply) threadKey {
	key := threadKey{MemoID: reply.MemoID, BotID: reply.BotID}
	if reply.RevisionNumber != nil {
		key.Revision = *reply.RevisionNumber
		key.HasRevision = true
	}
	return key
}

// canonicalReplies reproduces the previous server's duplicate-root cleanup: the
// oldest auto-reply per memo/bot/revision is the canonical root, and any other
// root (or its descendants) is hidden.
func canonicalReplies(replies []domain.BotReply) (
	[]domain.BotReply,
	map[threadKey]int64,
	map[threadKey]uuid.UUID,
) {
	parentByID := make(map[uuid.UUID]*uuid.UUID, len(replies))
	for i := range replies {
		parentByID[replies[i].ID] = replies[i].ParentReplyID
	}

	canonicalRoots := make(map[threadKey]struct{})
	duplicateRoots := make(map[uuid.UUID]struct{})
	for _, reply := range replies {
		if reply.ParentReplyID != nil || reply.UserQuestion != nil {
			continue
		}
		key := keyFor(reply)
		if _, ok := canonicalRoots[key]; ok {
			duplicateRoots[reply.ID] = struct{}{}
			continue
		}
		canonicalRoots[key] = struct{}{}
	}

	counts := make(map[threadKey]int64)
	latest := make(map[threadKey]uuid.UUID)
	kept := make([]domain.BotReply, 0, len(replies))
	for _, reply := range replies {
		if isDescendantOfDiscardedRoot(reply.ID, parentByID, duplicateRoots) {
			continue
		}
		kept = append(kept, reply)
		key := keyFor(reply)
		counts[key]++
		// Rows arrive ordered by created_at, so the last one is the latest.
		latest[key] = reply.ID
	}
	return kept, counts, latest
}

func isDescendantOfDiscardedRoot(
	replyID uuid.UUID,
	parentByID map[uuid.UUID]*uuid.UUID,
	discardedRoots map[uuid.UUID]struct{},
) bool {
	visited := make(map[uuid.UUID]struct{})
	current := &replyID
	for current != nil {
		if _, ok := discardedRoots[*current]; ok {
			return true
		}
		if _, ok := visited[*current]; ok {
			return false
		}
		visited[*current] = struct{}{}
		current = parentByID[*current]
	}
	return false
}

// BuildReplyTree nests replies under their parents and stamps thread metadata.
func BuildReplyTree(
	replies []domain.BotReply,
	summaries map[uuid.UUID]domain.BotSummary,
	counts map[threadKey]int64,
	latest map[threadKey]uuid.UUID,
) []domain.BotReplyNode {
	children := make(map[uuid.UUID][]domain.BotReply)
	roots := make([]domain.BotReply, 0)
	for _, reply := range replies {
		if reply.ParentReplyID == nil {
			roots = append(roots, reply)
			continue
		}
		children[*reply.ParentReplyID] = append(children[*reply.ParentReplyID], reply)
	}

	nodes := make([]domain.BotReplyNode, 0, len(roots))
	for _, root := range roots {
		nodes = append(nodes, buildNode(root, summaries, counts, latest, children))
	}
	return nodes
}

func buildNode(
	reply domain.BotReply,
	summaries map[uuid.UUID]domain.BotSummary,
	counts map[threadKey]int64,
	latest map[threadKey]uuid.UUID,
	children map[uuid.UUID][]domain.BotReply,
) domain.BotReplyNode {
	key := keyFor(reply)
	node := domain.BotReplyNode{
		Reply:         reply,
		Bot:           summaries[reply.BotID],
		Children:      []domain.BotReplyNode{},
		ThreadCount:   counts[key],
		LatestReplyID: latest[key],
	}
	if node.ThreadCount == 0 {
		node.ThreadCount = 1
	}
	if node.LatestReplyID == uuid.Nil {
		node.LatestReplyID = reply.ID
	}
	for _, child := range children[reply.ID] {
		node.Children = append(node.Children, buildNode(child, summaries, counts, latest, children))
	}
	return node
}

type threadReply struct {
	Reply       domain.BotReply
	ResourceIDs []uuid.UUID
}

type threadData struct {
	memoID        uuid.UUID
	bot           domain.BotSummary
	latestReplyID uuid.UUID
	replies       []threadReply
}

func (s *BotService) loadThread(
	ctx context.Context,
	userID, replyID uuid.UUID,
) (threadData, error) {
	seed, err := s.bots.ReplyByID(ctx, userID, replyID)
	if errors.Is(err, domain.ErrNoRows) {
		return threadData{}, domain.NotFound("Bot reply not found")
	}
	if err != nil {
		return threadData{}, domain.Internal(err)
	}

	bot, err := s.bots.ByID(ctx, userID, seed.BotID)
	if errors.Is(err, domain.ErrNoRows) {
		return threadData{}, domain.BotNotFound()
	}
	if err != nil {
		return threadData{}, domain.Internal(err)
	}

	rows, err := s.bots.ThreadReplies(ctx, seed.MemoID, seed.BotID, replyID)
	if err != nil {
		return threadData{}, domain.Internal(err)
	}
	if len(rows) == 0 {
		return threadData{}, domain.NotFound("Bot reply not found")
	}

	ids := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ID)
	}
	resources, err := s.bots.ResourceIDsForReplies(ctx, ids)
	if err != nil {
		return threadData{}, domain.Internal(err)
	}

	replies := make([]threadReply, 0, len(rows))
	for _, row := range rows {
		replies = append(replies, threadReply{Reply: row, ResourceIDs: resources[row.ID]})
	}
	return threadData{
		memoID:        seed.MemoID,
		bot:           domain.BotSummary{ID: bot.ID, Name: bot.Name, AvatarURL: bot.AvatarURL},
		latestReplyID: rows[len(rows)-1].ID,
		replies:       replies,
	}, nil
}

// BuildThreadMessages flattens a thread into user/assistant turns.
func BuildThreadMessages(replies []threadReply) []domain.BotThreadMessage {
	messages := make([]domain.BotThreadMessage, 0, len(replies)*2)
	for _, reply := range replies {
		if reply.Reply.UserQuestion != nil {
			messages = append(messages, domain.BotThreadMessage{
				ID:          reply.Reply.ID,
				Role:        "user",
				Content:     *reply.Reply.UserQuestion,
				ResourceIDs: resourceIDs(reply.ResourceIDs),
				CreatedAt:   reply.Reply.CreatedAt,
			})
		}
		messages = append(messages, domain.BotThreadMessage{
			ID:              reply.Reply.ID,
			Role:            "assistant",
			Content:         reply.Reply.Content,
			ThinkingContent: reply.Reply.ThinkingContent,
			ResourceIDs:     []uuid.UUID{},
			CreatedAt:       reply.Reply.CreatedAt,
		})
	}
	return messages
}

func resourceIDs(ids []uuid.UUID) []uuid.UUID {
	if ids == nil {
		return []uuid.UUID{}
	}
	return ids
}
