package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

type savedCursor struct {
	clientID string
	userID   uuid.UUID
	entity   string
	at       int64
}

type fakeSyncStore struct {
	memoUpdated     []domain.MemoChange
	memoDeleted     []uuid.UUID
	diaryUpdated    []domain.DiaryChange
	diaryDeleted    []string
	resourceUpdated []domain.ResourceChange
	resourceDeleted []uuid.UUID
	botUpdated      []domain.BotChange
	botDeleted      []uuid.UUID

	seenMemoCursor int64
	saved          []savedCursor
	failMemo       error
}

func (f *fakeSyncStore) MemoChanges(_ context.Context, _ uuid.UUID, cursor int64) ([]domain.MemoChange, []uuid.UUID, error) {
	f.seenMemoCursor = cursor
	if f.failMemo != nil {
		return nil, nil, f.failMemo
	}
	return f.memoUpdated, f.memoDeleted, nil
}

func (f *fakeSyncStore) DiaryChanges(context.Context, uuid.UUID, int64) ([]domain.DiaryChange, []string, error) {
	return f.diaryUpdated, f.diaryDeleted, nil
}

func (f *fakeSyncStore) ResourceChanges(context.Context, uuid.UUID, int64) ([]domain.ResourceChange, []uuid.UUID, error) {
	return f.resourceUpdated, f.resourceDeleted, nil
}

func (f *fakeSyncStore) BotChanges(context.Context, uuid.UUID, int64) ([]domain.BotChange, []uuid.UUID, error) {
	return f.botUpdated, f.botDeleted, nil
}

func (f *fakeSyncStore) SaveCursor(_ context.Context, clientID string, userID uuid.UUID, entity string, at int64) error {
	f.saved = append(f.saved, savedCursor{clientID: clientID, userID: userID, entity: entity, at: at})
	return nil
}

func newSyncFixture(t *testing.T) (*SyncService, *fakeSyncStore, uuid.UUID) {
	t.Helper()

	memoID := uuid.New()
	goneID := uuid.New()
	userID := uuid.New()

	store := &fakeSyncStore{
		memoUpdated: []domain.MemoChange{{
			ID:        memoID,
			Content:   "hello",
			Tags:      []string{"work"},
			CreatedAt: 100,
			UpdatedAt: 200,
		}},
		memoDeleted:     []uuid.UUID{goneID},
		diaryUpdated:    []domain.DiaryChange{{Date: domain.NewDate(mustSyncTime(t, "2026-01-02")), Summary: "day", MoodKey: "calm", MoodScore: 4, CreatedAt: 1, UpdatedAt: 2}},
		resourceUpdated: []domain.ResourceChange{{ID: uuid.New(), Filename: "a.png", ResourceType: "image", MimeType: "image/png", FileSize: 10, StorageType: "local", CreatedAt: 3}},
		botUpdated:      []domain.BotChange{{ID: uuid.New(), Name: "scribe", Tags: []string{"writer"}, AutoReply: true, SortOrder: 1, CreatedAt: 4, UpdatedAt: 5}},
	}

	frozen := int64(1_700_000_000_000)
	service := NewSyncService(store).WithClock(func() int64 { return frozen })
	return service, store, userID
}

func TestPullReportsEveryEntity(t *testing.T) {
	sync, _, userID := newSyncFixture(t)

	result, err := sync.Pull(context.Background(), userID.String(), "client-1", nil)
	if err != nil {
		t.Fatalf("Pull: %v", err)
	}

	if got := len(result.Changes.Memo.Updated); got != 1 {
		t.Errorf("memo updated = %d, want 1", got)
	}
	if got := len(result.Changes.Diary.Updated); got != 1 {
		t.Errorf("diary updated = %d, want 1", got)
	}
	if got := len(result.Changes.Resource.Updated); got != 1 {
		t.Errorf("resource updated = %d, want 1", got)
	}
	if got := len(result.Changes.Bot.Updated); got != 1 {
		t.Errorf("bot updated = %d, want 1", got)
	}

	for _, entity := range domain.SyncEntities {
		if _, ok := result.Cursors[entity]; !ok {
			t.Errorf("cursor for %q is missing", entity)
		}
	}
}

func TestPullCarriesDeletionMarkersRatherThanDroppingThem(t *testing.T) {
	sync, store, userID := newSyncFixture(t)

	result, err := sync.Pull(context.Background(), userID.String(), "client-1", nil)
	if err != nil {
		t.Fatalf("Pull: %v", err)
	}

	if got := len(result.Changes.Memo.DeletedIDs); got != 1 {
		t.Fatalf("memo deletion markers = %d, want 1", got)
	}
	if result.Changes.Memo.DeletedIDs[0] != store.memoDeleted[0].String() {
		t.Errorf("deletion marker = %q, want %q",
			result.Changes.Memo.DeletedIDs[0], store.memoDeleted[0].String())
	}
	// A deleted row must not also be reported as updated.
	for _, updated := range result.Changes.Memo.Updated {
		if updated["id"] == store.memoDeleted[0].String() {
			t.Error("deleted memo was also reported as updated")
		}
	}
}

func TestPullCursorsAdvanceStrictly(t *testing.T) {
	sync, _, userID := newSyncFixture(t)

	previous := map[string]int64{
		domain.SyncEntityMemo:     1_000,
		domain.SyncEntityDiary:    1_000,
		domain.SyncEntityResource: 1_000,
		domain.SyncEntityBot:      1_000,
	}

	first, err := sync.Pull(context.Background(), userID.String(), "client-1", previous)
	if err != nil {
		t.Fatalf("first Pull: %v", err)
	}

	for _, entity := range domain.SyncEntities {
		if first.Cursors[entity] <= previous[entity] {
			t.Errorf("cursor for %q = %d, want > %d", entity, first.Cursors[entity], previous[entity])
		}
	}

	// Resuming from the returned cursors must move forward again, which is what
	// keeps an offline client converging instead of replaying.
	second, err := sync.Pull(context.Background(), userID.String(), "client-1", first.Cursors)
	if err != nil {
		t.Fatalf("second Pull: %v", err)
	}
	for _, entity := range domain.SyncEntities {
		if second.Cursors[entity] < first.Cursors[entity] {
			t.Errorf("cursor for %q went backwards: %d then %d",
				entity, first.Cursors[entity], second.Cursors[entity])
		}
	}
}

func TestPullUsesTheCursorTheClientSent(t *testing.T) {
	sync, store, userID := newSyncFixture(t)

	if _, err := sync.Pull(context.Background(), userID.String(), "client-1",
		map[string]int64{domain.SyncEntityMemo: 4242}); err != nil {
		t.Fatalf("Pull: %v", err)
	}

	if store.seenMemoCursor != 4242 {
		t.Errorf("memo cursor passed to the store = %d, want 4242", store.seenMemoCursor)
	}
}

func TestPullPersistsACursorPerEntityAndClient(t *testing.T) {
	sync, store, userID := newSyncFixture(t)

	if _, err := sync.Pull(context.Background(), userID.String(), "client-9", nil); err != nil {
		t.Fatalf("Pull: %v", err)
	}

	if len(store.saved) != len(domain.SyncEntities) {
		t.Fatalf("saved cursors = %d, want %d", len(store.saved), len(domain.SyncEntities))
	}

	seen := map[string]bool{}
	for _, cursor := range store.saved {
		if cursor.clientID != "client-9" {
			t.Errorf("client id = %q, want client-9", cursor.clientID)
		}
		if cursor.userID != userID {
			t.Errorf("user id = %v, want %v", cursor.userID, userID)
		}
		seen[cursor.entity] = true
	}
	for _, entity := range domain.SyncEntities {
		if !seen[entity] {
			t.Errorf("no cursor persisted for %q", entity)
		}
	}
}

func TestPullRejectsAMalformedUserID(t *testing.T) {
	sync, _, _ := newSyncFixture(t)

	_, err := sync.Pull(context.Background(), "not-a-uuid", "client-1", nil)

	var domainErr *domain.Error
	if !errors.As(err, &domainErr) || domainErr.Kind != domain.KindInvalidInput {
		t.Fatalf("err = %v, want invalid input", err)
	}
}

func TestPullWrapsStoreFailures(t *testing.T) {
	sync, store, userID := newSyncFixture(t)
	store.failMemo = errors.New("connection reset")

	_, err := sync.Pull(context.Background(), userID.String(), "client-1", nil)

	var domainErr *domain.Error
	if !errors.As(err, &domainErr) || domainErr.Kind != domain.KindInternal {
		t.Fatalf("err = %v, want internal", err)
	}
}

func TestEntityChangeSetsSerializeAsEmptyArrays(t *testing.T) {
	sync, store, userID := newSyncFixture(t)
	store.memoUpdated = nil
	store.memoDeleted = nil

	result, err := sync.Pull(context.Background(), userID.String(), "client-1", nil)
	if err != nil {
		t.Fatalf("Pull: %v", err)
	}

	if result.Changes.Memo.Updated == nil {
		t.Error("updated must be an empty slice, not nil")
	}
	if result.Changes.Memo.DeletedIDs == nil {
		t.Error("deletedIds must be an empty slice, not nil")
	}
}

// mustSyncTime parses a date for fixtures. It is named distinctly so it cannot
// collide with helpers other module tests may declare in this package.
func mustSyncTime(t *testing.T, value string) time.Time {
	t.Helper()
	parsed, err := time.Parse(domain.DateLayout, value)
	if err != nil {
		t.Fatalf("parsing %q: %v", value, err)
	}
	return parsed
}
