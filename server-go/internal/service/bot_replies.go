package service

import (
	"context"
	"errors"
	"log/slog"
	"time"

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
	latest := seed.ID
	for _, row := range rows {
		if row.Status == "" || row.Status == domain.BotReplyStatusCompleted {
			latest = row.ID
		}
	}
	return threadData{
		memoID:        seed.MemoID,
		bot:           domain.BotSummary{ID: bot.ID, Name: bot.Name, AvatarURL: bot.AvatarURL},
		latestReplyID: latest,
		replies:       replies,
	}, nil
}

// reconcilePendingReplies marks abandoned pending turns failed so the client
// stops waiting on a generation whose process disappeared.
func (s *BotService) reconcilePendingReplies(
	ctx context.Context,
	userID uuid.UUID,
	thread *threadData,
) {
	now := s.now()
	staleBefore := now - int64(botReplyPendingTimeout/time.Millisecond)
	for index := range thread.replies {
		reply := &thread.replies[index].Reply
		if reply.Status != domain.BotReplyStatusPending || reply.UpdatedAt >= staleBefore {
			continue
		}
		message := "generation timed out"
		if err := s.bots.FailReply(
			context.WithoutCancel(ctx), reply.ID, reply.ClaimVersion, message, now,
		); err != nil {
			if errors.Is(err, domain.ErrNoRows) {
				if refreshed, refreshErr := s.bots.ReplyByID(ctx, userID, reply.ID); refreshErr == nil {
					*reply = refreshed
				}
				continue
			}
			slog.WarnContext(ctx, "failing stale bot reply", "replyId", reply.ID, "err", err)
			continue
		}
		reply.Status = domain.BotReplyStatusFailed
		reply.ErrorMessage = &message
		reply.UpdatedAt = now
	}
}

// BuildThreadMessages flattens a thread into user/assistant turns.
func BuildThreadMessages(replies []threadReply) []domain.BotThreadMessage {
	messages := make([]domain.BotThreadMessage, 0, len(replies)*2)
	for _, reply := range replies {
		status := reply.Reply.Status
		if status == "" {
			status = domain.BotReplyStatusCompleted
		}
		if reply.Reply.UserQuestion != nil {
			messages = append(messages, domain.BotThreadMessage{
				ID:              reply.Reply.ID,
				Role:            "user",
				Content:         *reply.Reply.UserQuestion,
				ResourceIDs:     resourceIDs(reply.ResourceIDs),
				ClientRequestID: reply.Reply.ClientRequestID,
				Status:          domain.BotReplyStatusCompleted,
				CreatedAt:       reply.Reply.CreatedAt,
			})
		}
		assistant := domain.BotThreadMessage{
			ID:              reply.Reply.ID,
			Role:            "assistant",
			ResourceIDs:     []uuid.UUID{},
			ClientRequestID: reply.Reply.ClientRequestID,
			Status:          status,
			CreatedAt:       reply.Reply.CreatedAt,
		}
		switch status {
		case domain.BotReplyStatusPending:
		case domain.BotReplyStatusFailed:
			assistant.ErrorMessage = reply.Reply.ErrorMessage
		default:
			assistant.Content = reply.Reply.Content
			assistant.ThinkingContent = reply.Reply.ThinkingContent
		}
		messages = append(messages, assistant)
	}
	return messages
}

func resourceIDs(ids []uuid.UUID) []uuid.UUID {
	if ids == nil {
		return []uuid.UUID{}
	}
	return ids
}
