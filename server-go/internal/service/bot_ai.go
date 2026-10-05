package service

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/retry"
)

// Reply generation bounds, unchanged from the previous server.
const (
	maxAIQuestionImages = 4
	maxThreadReplies    = 8
	maxThreadImages     = 8
)

// ChatMessage is one turn handed to the provider.
type ChatMessage struct {
	Role    string
	Content any
}

// CompletionRequest is the narrow view of a chat completion this package needs.
// It exists so the service never imports the provider client package; an adapter
// translates it at wiring time.
type CompletionRequest struct {
	Config       domain.AIConfig
	SystemPrompt string
	Messages     []ChatMessage
	Model        string
}

// CompletionResult is the provider's answer, including any reasoning content.
type CompletionResult struct {
	Content         string
	ThinkingContent *string
}

// CompletionClient performs chat completions.
type CompletionClient interface {
	Complete(ctx context.Context, req CompletionRequest) (CompletionResult, error)
}

// ImageInput is one image attached to a prompt.
type ImageInput struct {
	MimeType string
	Data     []byte
}

// ImageProvider supplies the images a reply prompt may carry.
type ImageProvider interface {
	MemoImages(ctx context.Context, userID, memoID uuid.UUID, limit int) ([]ImageInput, error)
	OwnedImages(
		ctx context.Context,
		userID uuid.UUID,
		resourceIDs []uuid.UUID,
		limit int,
	) ([]ImageInput, error)
}

// TriggerReplies generates the auto replies for a memo in the background and
// returns as soon as the work is scheduled.
func (s *BotService) TriggerReplies(ctx context.Context, userID string, memoID uuid.UUID) error {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domain.InvalidUUID(err)
	}
	config, err := s.configs.ChatConfig(ctx, id)
	if err != nil {
		return wrapInternal(err)
	}

	memo, err := s.memos.MemoForBot(ctx, id, memoID)
	if errors.Is(err, domain.ErrNoRows) {
		return domain.MemoNotFound()
	}
	if err != nil {
		return domain.Internal(err)
	}

	memoContent := memo.Content
	if memo.RevisionCount > 1 {
		revisions, err := s.memos.RevisionsForContext(ctx, memoID, memo.RevisionCount)
		if err != nil {
			slog.ErrorContext(ctx, "loading revisions for bot context",
				"memoId", memoID, "err", err)
			revisions = nil
		}
		memoContent = BuildRevisionContext(revisions)
	}

	bots, err := s.bots.AutoReplyBots(ctx, id)
	if err != nil {
		return domain.Internal(err)
	}
	if len(bots) == 0 {
		return nil
	}

	images, err := s.images.MemoImages(ctx, id, memoID, maxAIQuestionImages)
	if err != nil {
		return wrapInternal(err)
	}
	memoryContext, hasContext := s.buildMemoryContext(ctx, memo)
	loc := s.timezones.Timezone(ctx)

	// The guard is a database advisory lock rather than process state, so it
	// serialises generations across every server sharing the database. A second
	// trigger for the same memo is skipped, not queued.
	release, acquired, err := s.locks.TryAcquire(ctx, memoID.String())
	if err != nil {
		return domain.Internal(err)
	}
	if !acquired {
		slog.InfoContext(ctx, "skipped duplicate bot generation", "memoId", memoID)
		return nil
	}

	s.record("trigger_replies", "memo", memoID, "Bot auto-reply triggered")

	generationCtx := context.WithoutCancel(ctx)
	go func() {
		defer release()
		s.generateAutoReplies(
			generationCtx, id, memo, memoContent, config, bots, images,
			memoryContext, hasContext, loc)
	}()
	return nil
}

// MemoGenerationLocks takes the cross-process lock that serialises bot
// generation for one memo.
type MemoGenerationLocks interface {
	TryAcquire(ctx context.Context, key string) (release func(), acquired bool, err error)
}

func (s *BotService) generateAutoReplies(
	ctx context.Context,
	userID uuid.UUID,
	memo domain.Memo,
	memoContent string,
	config domain.AIConfig,
	bots []domain.Bot,
	images []ImageInput,
	memoryContext domain.BotMemoryContext,
	hasContext bool,
	loc *time.Location,
) {
	var wait sync.WaitGroup
	for _, bot := range bots {
		bot := bot
		wait.Add(1)
		go func() {
			defer wait.Done()
			s.generateOneAutoReply(ctx, userID, memo, memoContent, config, bot,
				images, memoryContext, hasContext, loc)
		}()
	}
	wait.Wait()
}

func (s *BotService) generateOneAutoReply(
	ctx context.Context,
	userID uuid.UUID,
	memo domain.Memo,
	memoContent string,
	config domain.AIConfig,
	bot domain.Bot,
	images []ImageInput,
	memoryContext domain.BotMemoryContext,
	hasContext bool,
	loc *time.Location,
) {
	if hasContext {
		if err := s.memory.PersistForBot(ctx, userID, memo.ID, bot.ID, memoryContext); err != nil {
			slog.WarnContext(ctx, "persisting memory context", "err", err)
		}
	}

	memoryPrefix := ""
	if hasContext {
		memoryPrefix = BuildMemoryPrefix(memoryContext.SimilarMemos, s.now(), loc)
	}
	systemPrompt := BuildAutoReplySystemPrompt(
		bot.Name, bot.Description, FormatCurrentTime(s.now(), loc))
	messages := BuildAutoReplyMessages(memoContent, memoryPrefix, images)

	var result CompletionResult
	err := retry.Do(ctx, retry.DefaultPolicy(), func(ctx context.Context) error {
		reply, callErr := s.completions.Complete(ctx, CompletionRequest{
			Config:       config,
			SystemPrompt: systemPrompt,
			Messages:     messages,
			Model:        derefString(bot.Model),
		})
		if callErr != nil {
			return callErr
		}
		result = reply
		return nil
	})
	if err != nil {
		slog.ErrorContext(ctx, "generating bot auto reply",
			"memoId", memo.ID, "botId", bot.ID, "err", err)
		return
	}

	revision := memo.RevisionCount
	reply := domain.BotReply{
		ID:              uuid.New(),
		MemoID:          memo.ID,
		BotID:           bot.ID,
		Content:         result.Content,
		ThinkingContent: result.ThinkingContent,
		RevisionNumber:  &revision,
		CreatedAt:       s.now(),
	}
	inserted, err := s.bots.InsertAutoReply(ctx, reply, memo.RevisionCount)
	if err != nil {
		slog.ErrorContext(ctx, "persisting bot auto reply", "err", err)
		return
	}
	if !inserted {
		slog.InfoContext(ctx, "discarded stale or duplicate auto reply",
			"memoId", memo.ID, "botId", bot.ID, "revision", revision)
	}
}

// ReplyToBot answers a user's follow-up inside a bot conversation.
func (s *BotService) ReplyToBot(
	ctx context.Context,
	userID string,
	parentReplyID uuid.UUID,
	question string,
	resourceIDs []uuid.UUID,
) (domain.BotReplyNode, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domain.BotReplyNode{}, domain.InvalidUUID(err)
	}
	config, err := s.configs.ChatConfig(ctx, id)
	if err != nil {
		return domain.BotReplyNode{}, wrapInternal(err)
	}

	parent, err := s.bots.ReplyByID(ctx, id, parentReplyID)
	if errors.Is(err, domain.ErrNoRows) {
		return domain.BotReplyNode{}, domain.NotFound("Bot reply not found")
	}
	if err != nil {
		return domain.BotReplyNode{}, domain.Internal(err)
	}
	bot, err := s.bots.ByID(ctx, id, parent.BotID)
	if errors.Is(err, domain.ErrNoRows) {
		return domain.BotReplyNode{}, domain.BotNotFound()
	}
	if err != nil {
		return domain.BotReplyNode{}, domain.Internal(err)
	}
	memo, err := s.memos.MemoForBot(ctx, id, parent.MemoID)
	if errors.Is(err, domain.ErrNoRows) {
		return domain.BotReplyNode{}, domain.MemoNotFound()
	}
	if err != nil {
		return domain.BotReplyNode{}, domain.Internal(err)
	}

	if len(resourceIDs) > maxAIQuestionImages {
		return domain.BotReplyNode{}, domain.InvalidInput("Maximum 4 images allowed")
	}
	var questionImages []ImageInput
	if len(resourceIDs) > 0 {
		questionImages, err = s.images.OwnedImages(ctx, id, resourceIDs, maxAIQuestionImages)
		if err != nil {
			return domain.BotReplyNode{}, wrapInternal(err)
		}
	}

	thread, err := s.loadThread(ctx, id, parentReplyID)
	if err != nil {
		return domain.BotReplyNode{}, err
	}
	history, err := s.buildThreadHistory(ctx, id, thread.replies, config.Provider)
	if err != nil {
		return domain.BotReplyNode{}, err
	}

	memoryContext, hasContext := s.buildMemoryContext(ctx, memo)
	loc := s.timezones.Timezone(ctx)
	memoryPrefix := ""
	if hasContext {
		memoryPrefix = BuildMemoryPrefix(memoryContext.SimilarMemos, s.now(), loc)
		if err := s.memory.PersistForBot(
			context.WithoutCancel(ctx), id, memo.ID, bot.ID, memoryContext,
		); err != nil {
			slog.WarnContext(ctx, "persisting memory context", "err", err)
		}
	}

	result, err := s.completions.Complete(ctx, CompletionRequest{
		Config: config,
		SystemPrompt: BuildThreadSystemPrompt(
			bot.Name, bot.Description, FormatCurrentTime(s.now(), loc)),
		Messages: BuildThreadReplyMessages(
			memo.Content, memoryPrefix, history, question, questionImages),
		Model: derefString(bot.Model),
	})
	if err != nil {
		return domain.BotReplyNode{}, wrapInternal(err)
	}

	revision := memo.RevisionCount
	if parent.RevisionNumber != nil {
		revision = *parent.RevisionNumber
	}
	now := s.now()
	parentID := parentReplyID
	newReply := domain.BotReply{
		ID:              uuid.New(),
		MemoID:          parent.MemoID,
		BotID:           parent.BotID,
		Content:         result.Content,
		ThinkingContent: result.ThinkingContent,
		ParentReplyID:   &parentID,
		UserQuestion:    &question,
		RevisionNumber:  &revision,
		CreatedAt:       now,
	}
	if err := s.bots.InsertReply(ctx, newReply); err != nil {
		return domain.BotReplyNode{}, domain.Internal(err)
	}
	if len(resourceIDs) > 0 {
		if err := s.bots.InsertReplyResources(ctx, newReply.ID, resourceIDs, now); err != nil {
			return domain.BotReplyNode{}, domain.Internal(err)
		}
	}

	s.record("reply_to_bot", "bot_reply", newReply.ID, "User replied to bot: "+bot.Name)
	return domain.BotReplyNode{
		Reply: newReply,
		Bot: domain.BotSummary{
			ID: bot.ID, Name: bot.Name, AvatarURL: bot.AvatarURL,
		},
		Children:      []domain.BotReplyNode{},
		ThreadCount:   int64(len(thread.replies) + 1),
		LatestReplyID: newReply.ID,
	}, nil
}

func (s *BotService) buildThreadHistory(
	ctx context.Context,
	userID uuid.UUID,
	replies []threadReply,
	provider string,
) ([]ChatMessage, error) {
	start := len(replies) - maxThreadReplies
	if start < 0 {
		start = 0
	}
	messages := make([]ChatMessage, 0, len(replies)*2)
	remaining := maxThreadImages
	for _, reply := range replies[start:] {
		if reply.Reply.UserQuestion != nil {
			var images []ImageInput
			if remaining > 0 {
				limit := remaining
				if limit > maxAIQuestionImages {
					limit = maxAIQuestionImages
				}
				loaded, err := s.images.OwnedImages(ctx, userID, reply.ResourceIDs, limit)
				if err != nil {
					return nil, wrapInternal(err)
				}
				images = loaded
				remaining -= len(loaded)
			}
			messages = append(messages, BuildUserMessage(*reply.Reply.UserQuestion, images))
		}
		messages = append(messages, ChatMessage{
			Role: "assistant", Content: reply.Reply.Content,
		})
	}
	return messages, nil
}

func (s *BotService) buildMemoryContext(
	ctx context.Context,
	memo domain.Memo,
) (domain.BotMemoryContext, bool) {
	memoryContext, err := s.memory.BuildForMemo(ctx, memo)
	if err != nil {
		slog.WarnContext(ctx, "building bot memory context", "memoId", memo.ID, "err", err)
		return domain.BotMemoryContext{}, false
	}
	return memoryContext, true
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func wrapInternal(err error) *domain.Error {
	var domainErr *domain.Error
	if errors.As(err, &domainErr) {
		return domainErr
	}
	return domain.Internal(err)
}

// generationGuard prevents two in-process generations for the same memo. The
// previous server used a database advisory lock; this is the process-local
// equivalent.
