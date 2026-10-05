package service

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// SyncStore reads the rows that changed since a cursor and persists the cursors
// a client reported.
type SyncStore interface {
	MemoChanges(ctx context.Context, userID uuid.UUID, cursor int64) ([]domain.MemoChange, []uuid.UUID, error)
	DiaryChanges(ctx context.Context, userID uuid.UUID, cursor int64) ([]domain.DiaryChange, []string, error)
	ResourceChanges(ctx context.Context, userID uuid.UUID, cursor int64) ([]domain.ResourceChange, []uuid.UUID, error)
	BotChanges(ctx context.Context, userID uuid.UUID, cursor int64) ([]domain.BotChange, []uuid.UUID, error)
	SaveCursor(ctx context.Context, clientID string, userID uuid.UUID, entity string, at int64) error
}

// SyncService produces incremental change sets for offline clients.
type SyncService struct {
	store SyncStore
	// now supplies the cursor timestamp. It is injectable so the cursor
	// arithmetic can be tested without waiting on the clock.
	now func() int64
}

func NewSyncService(store SyncStore) *SyncService {
	return &SyncService{store: store, now: func() int64 { return time.Now().UnixMilli() }}
}

// WithClock replaces the cursor clock. Intended for tests.
func (s *SyncService) WithClock(now func() int64) *SyncService {
	s.now = now
	return s
}

// Pull returns everything that changed for the user since the supplied cursors,
// together with the new cursors the client must store.
func (s *SyncService) Pull(
	ctx context.Context,
	userID, clientID string,
	cursors map[string]int64,
) (*domain.SyncPullResult, error) {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, domain.InvalidUUID(err)
	}

	changes := domain.EntityChanges{
		Memo:     domain.NewEntityChangeSet(),
		Diary:    domain.NewEntityChangeSet(),
		Resource: domain.NewEntityChangeSet(),
		Bot:      domain.NewEntityChangeSet(),
	}

	if changes.Memo, err = s.memoChanges(ctx, userUUID, cursorFor(cursors, domain.SyncEntityMemo)); err != nil {
		return nil, err
	}
	if changes.Diary, err = s.diaryChanges(ctx, userUUID, cursorFor(cursors, domain.SyncEntityDiary)); err != nil {
		return nil, err
	}
	if changes.Resource, err = s.resourceChanges(ctx, userUUID, cursorFor(cursors, domain.SyncEntityResource)); err != nil {
		return nil, err
	}
	if changes.Bot, err = s.botChanges(ctx, userUUID, cursorFor(cursors, domain.SyncEntityBot)); err != nil {
		return nil, err
	}

	cursor := s.now()
	advanced := make(map[string]int64, len(domain.SyncEntities))
	for _, entity := range domain.SyncEntities {
		advanced[entity] = cursor
		if err := s.store.SaveCursor(ctx, clientID, userUUID, entity, cursor); err != nil {
			return nil, domain.Internal(err)
		}
	}

	return &domain.SyncPullResult{Cursors: advanced, Changes: changes}, nil
}

func (s *SyncService) memoChanges(
	ctx context.Context,
	userID uuid.UUID,
	cursor int64,
) (domain.EntityChangeSet, error) {
	rows, deleted, err := s.store.MemoChanges(ctx, userID, cursor)
	if err != nil {
		return domain.EntityChangeSet{}, domain.Internal(err)
	}

	set := domain.NewEntityChangeSet()
	for _, memo := range rows {
		set.Updated = append(set.Updated, map[string]any{
			"id":         memo.ID.String(),
			"content":    memo.Content,
			"tags":       nonNilStrings(memo.Tags),
			"isArchived": memo.IsArchived,
			"isDeleted":  false,
			"diaryDate":  domain.StringOrNil(memo.DiaryDate),
			"aiSummary":  memo.AiSummary,
			"createdAt":  memo.CreatedAt,
			"updatedAt":  memo.UpdatedAt,
		})
	}
	set.DeletedIDs = uuidStrings(deleted)
	return set, nil
}

func (s *SyncService) diaryChanges(
	ctx context.Context,
	userID uuid.UUID,
	cursor int64,
) (domain.EntityChangeSet, error) {
	rows, deleted, err := s.store.DiaryChanges(ctx, userID, cursor)
	if err != nil {
		return domain.EntityChangeSet{}, domain.Internal(err)
	}

	set := domain.NewEntityChangeSet()
	for _, diary := range rows {
		set.Updated = append(set.Updated, map[string]any{
			"date":      diary.Date.String(),
			"summary":   diary.Summary,
			"moodKey":   diary.MoodKey,
			"moodScore": diary.MoodScore,
			"createdAt": diary.CreatedAt,
			"updatedAt": diary.UpdatedAt,
		})
	}
	set.DeletedIDs = nonNilStrings(deleted)
	return set, nil
}

func (s *SyncService) resourceChanges(
	ctx context.Context,
	userID uuid.UUID,
	cursor int64,
) (domain.EntityChangeSet, error) {
	rows, deleted, err := s.store.ResourceChanges(ctx, userID, cursor)
	if err != nil {
		return domain.EntityChangeSet{}, domain.Internal(err)
	}

	set := domain.NewEntityChangeSet()
	for _, resource := range rows {
		set.Updated = append(set.Updated, map[string]any{
			"id":           resource.ID.String(),
			"memoId":       optionalUUIDString(resource.MemoID),
			"filename":     resource.Filename,
			"resourceType": resource.ResourceType,
			"mimeType":     resource.MimeType,
			"fileSize":     resource.FileSize,
			"storageType":  resource.StorageType,
			"createdAt":    resource.CreatedAt,
		})
	}
	set.DeletedIDs = uuidStrings(deleted)
	return set, nil
}

func (s *SyncService) botChanges(
	ctx context.Context,
	userID uuid.UUID,
	cursor int64,
) (domain.EntityChangeSet, error) {
	rows, deleted, err := s.store.BotChanges(ctx, userID, cursor)
	if err != nil {
		return domain.EntityChangeSet{}, domain.Internal(err)
	}

	set := domain.NewEntityChangeSet()
	for _, bot := range rows {
		set.Updated = append(set.Updated, map[string]any{
			"id":          bot.ID.String(),
			"name":        bot.Name,
			"avatarUrl":   bot.AvatarURL,
			"description": bot.Description,
			"tags":        nonNilStrings(bot.Tags),
			"autoReply":   bot.AutoReply,
			"sortOrder":   bot.SortOrder,
			"createdAt":   bot.CreatedAt,
			"updatedAt":   bot.UpdatedAt,
		})
	}
	set.DeletedIDs = uuidStrings(deleted)
	return set, nil
}

// cursorFor reads an entity's cursor, treating a missing entry as zero so a
// first-time client receives the full history.
func cursorFor(cursors map[string]int64, entity string) int64 {
	if cursors == nil {
		return 0
	}
	return cursors[entity]
}

func uuidStrings(ids []uuid.UUID) []string {
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		out = append(out, id.String())
	}
	return out
}

func optionalUUIDString(id *uuid.UUID) *string {
	if id == nil {
		return nil
	}
	rendered := id.String()
	return &rendered
}

func nonNilStrings(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}
