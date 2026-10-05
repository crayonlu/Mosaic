package service

import (
	"context"
	"sort"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

func diaryTestDate(year int, month time.Month, day int) domain.Date {
	return domain.NewDate(time.Date(year, month, day, 0, 0, 0, 0, time.UTC))
}

// diaryFakeStore is an in-memory DiaryStore.
type diaryFakeStore struct {
	diaries   []domain.Diary
	memos     map[string][]domain.Memo
	resources map[uuid.UUID][]domain.Resource

	lastPage     uint32
	lastPageSize uint32
}

func newDiaryFakeStore() *diaryFakeStore {
	return &diaryFakeStore{
		memos:     map[string][]domain.Memo{},
		resources: map[uuid.UUID][]domain.Resource{},
	}
}

func (f *diaryFakeStore) List(
	_ context.Context,
	_ uuid.UUID,
	page, pageSize uint32,
	start, end *domain.Date,
) ([]domain.Diary, int64, error) {
	f.lastPage, f.lastPageSize = page, pageSize

	filtered := []domain.Diary{}
	for _, diary := range f.diaries {
		if start != nil && diary.Date.Time.Before(start.Time) {
			continue
		}
		if end != nil && diary.Date.Time.After(end.Time) {
			continue
		}
		filtered = append(filtered, diary)
	}
	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].Date.Time.After(filtered[j].Date.Time)
	})

	total := int64(len(filtered))
	offset := int(page-1) * int(pageSize)
	if offset >= len(filtered) {
		return []domain.Diary{}, total, nil
	}
	upper := offset + int(pageSize)
	if upper > len(filtered) {
		upper = len(filtered)
	}
	return filtered[offset:upper], total, nil
}

func (f *diaryFakeStore) ByDate(_ context.Context, _ uuid.UUID, date domain.Date) (domain.Diary, error) {
	for _, diary := range f.diaries {
		if diary.Date.String() == date.String() {
			return diary, nil
		}
	}
	return domain.Diary{}, domain.ErrNoRows
}

func (f *diaryFakeStore) MemosForDate(
	_ context.Context,
	_ uuid.UUID,
	date domain.Date,
) ([]domain.Memo, error) {
	return f.memos[date.String()], nil
}

func (f *diaryFakeStore) MemoResources(_ context.Context, memoID uuid.UUID) ([]domain.Resource, error) {
	return f.resources[memoID], nil
}

func (f *diaryFakeStore) Upsert(
	_ context.Context,
	userID uuid.UUID,
	date domain.Date,
	summary, moodKey string,
	moodScore int32,
	now int64,
) (domain.Diary, error) {
	for i, diary := range f.diaries {
		if diary.Date.String() == date.String() {
			diary.Summary = summary
			diary.MoodKey = moodKey
			diary.MoodScore = moodScore
			diary.GenerationSource = domain.GenerationSourceManual
			diary.AutoGenerationLocked = true
			diary.UpdatedAt = now
			f.diaries[i] = diary
			return diary, nil
		}
	}

	diary := domain.Diary{
		Date:                 date,
		UserID:               userID,
		Summary:              summary,
		MoodKey:              moodKey,
		MoodScore:            moodScore,
		GenerationSource:     domain.GenerationSourceManual,
		AutoGenerationLocked: true,
		GeneratedFromMemoIDs: []uuid.UUID{},
		CreatedAt:            now,
		UpdatedAt:            now,
	}
	f.diaries = append(f.diaries, diary)
	return diary, nil
}

func (f *diaryFakeStore) Update(
	_ context.Context,
	_ uuid.UUID,
	date domain.Date,
	summary, moodKey *string,
	moodScore *int32,
	now int64,
) (domain.Diary, error) {
	for i, diary := range f.diaries {
		if diary.Date.String() != date.String() {
			continue
		}
		if summary != nil {
			diary.Summary = *summary
		}
		if moodKey != nil {
			diary.MoodKey = *moodKey
		}
		if moodScore != nil {
			diary.MoodScore = *moodScore
		}
		diary.GenerationSource = domain.GenerationSourceManual
		diary.AutoGenerationLocked = true
		diary.UpdatedAt = now
		f.diaries[i] = diary
		return diary, nil
	}
	return domain.Diary{}, domain.ErrNoRows
}

func TestDiaryServiceListNormalizesPagination(t *testing.T) {
	store := newDiaryFakeStore()
	for day := 1; day <= 3; day++ {
		store.diaries = append(store.diaries, domain.Diary{
			Date:      diaryTestDate(2026, time.February, day),
			Summary:   "entry",
			MoodKey:   "joy",
			MoodScore: 5,
		})
	}
	svc := NewDiaryService(store)

	page, err := svc.List(context.Background(), uuid.New().String(), domain.DiaryFilter{})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if page.Page != 1 || page.PageSize != defaultDiaryPageSize {
		t.Errorf("pagination = (%d, %d), want (1, %d)", page.Page, page.PageSize, defaultDiaryPageSize)
	}
	if page.Total != 3 || page.TotalPages != 1 {
		t.Errorf("total = %d, totalPages = %d, want 3 and 1", page.Total, page.TotalPages)
	}
	if len(page.Items) != 3 {
		t.Fatalf("items = %d, want 3", len(page.Items))
	}
	if got := page.Items[0].Date.String(); got != "2026-02-03" {
		t.Errorf("first item date = %s, want 2026-02-03 (newest first)", got)
	}
}

func TestDiaryServiceGetReturnsNilWhenAbsent(t *testing.T) {
	svc := NewDiaryService(newDiaryFakeStore())

	detail, err := svc.Get(context.Background(), uuid.New().String(), diaryTestDate(2026, time.February, 1))
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if detail != nil {
		t.Errorf("detail = %+v, want nil", detail)
	}
}

func TestDiaryServiceGetAssemblesMemosAndResources(t *testing.T) {
	store := newDiaryFakeStore()
	date := diaryTestDate(2026, time.February, 2)
	store.diaries = append(store.diaries, domain.Diary{
		Date: date, Summary: "day", MoodKey: "calm", MoodScore: 6,
	})
	memoID := uuid.New()
	store.memos[date.String()] = []domain.Memo{{ID: memoID, Content: "note"}}
	store.resources[memoID] = []domain.Resource{{ID: uuid.New(), Filename: "photo.jpg"}}

	svc := NewDiaryService(store)
	detail, err := svc.Get(context.Background(), uuid.New().String(), date)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if detail == nil {
		t.Fatal("detail = nil, want a diary")
	}
	if len(detail.Memos) != 1 {
		t.Fatalf("memos = %d, want 1", len(detail.Memos))
	}
	if len(detail.Memos[0].Resources) != 1 || detail.Memos[0].Resources[0].Filename != "photo.jpg" {
		t.Errorf("resources = %+v, want one photo.jpg", detail.Memos[0].Resources)
	}
}

func TestDiaryServiceCreateLockAndUpdate(t *testing.T) {
	store := newDiaryFakeStore()
	svc := NewDiaryService(store)
	date := diaryTestDate(2026, time.February, 3)
	userID := uuid.New().String()

	created, err := svc.Create(context.Background(), userID, date, "first", "joy", 8)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if created.GenerationSource != domain.GenerationSourceManual || !created.AutoGenerationLocked {
		t.Errorf("created diary is not a locked manual entry: %+v", created)
	}

	summary := "second"
	updated, err := svc.Update(context.Background(), userID, date, &summary, nil, nil)
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if updated.Summary != "second" {
		t.Errorf("summary = %q, want second", updated.Summary)
	}
	if updated.MoodScore != 8 {
		t.Errorf("mood score = %d, want the untouched 8", updated.MoodScore)
	}
}

func TestDiaryServiceUpdateMissingIsNotFound(t *testing.T) {
	svc := NewDiaryService(newDiaryFakeStore())
	summary := "x"

	_, err := svc.Update(context.Background(), uuid.New().String(),
		diaryTestDate(2026, time.February, 4), &summary, nil, nil)
	assertKind(t, err, domain.KindNotFound)
}
