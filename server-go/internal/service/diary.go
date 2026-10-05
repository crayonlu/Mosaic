package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// defaultDiaryPageSize matches the previous server's list default.
const defaultDiaryPageSize = 20

// DiaryStore is the persistence the diary service depends on.
type DiaryStore interface {
	List(ctx context.Context, userID uuid.UUID, page, pageSize uint32, start, end *domain.Date) ([]domain.Diary, int64, error)
	ByDate(ctx context.Context, userID uuid.UUID, date domain.Date) (domain.Diary, error)
	MemosForDate(ctx context.Context, userID uuid.UUID, date domain.Date) ([]domain.Memo, error)
	MemoResources(ctx context.Context, memoID uuid.UUID) ([]domain.Resource, error)
	Upsert(ctx context.Context, userID uuid.UUID, date domain.Date, summary, moodKey string, moodScore int32, now int64) (domain.Diary, error)
	Update(ctx context.Context, userID uuid.UUID, date domain.Date, summary, moodKey *string, moodScore *int32, now int64) (domain.Diary, error)
}

// DiaryMemo is one of a day's memos together with its attachments.
type DiaryMemo struct {
	Memo      domain.Memo
	Resources []domain.Resource
}

// DiaryDetail is a diary together with the memos archived for that day.
type DiaryDetail struct {
	Diary domain.Diary
	Memos []DiaryMemo
}

// DiaryService implements the diary endpoints.
type DiaryService struct {
	diaries DiaryStore
}

func NewDiaryService(diaries DiaryStore) *DiaryService {
	return &DiaryService{diaries: diaries}
}

// List returns a page of diaries, newest first.
func (s *DiaryService) List(
	ctx context.Context,
	userID string,
	filter domain.DiaryFilter,
) (domain.Paginated[domain.Diary], error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domain.Paginated[domain.Diary]{}, domain.InvalidUUID(err)
	}

	page, pageSize := domain.NormalizePage(filter.Page, filter.PageSize, defaultDiaryPageSize)
	items, total, err := s.diaries.List(ctx, id, page, pageSize, filter.StartDate, filter.EndDate)
	if err != nil {
		return domain.Paginated[domain.Diary]{}, domain.Internal(err)
	}
	return domain.NewPaginated(items, total, page, pageSize), nil
}

// Get returns a diary and its memos, or nil when no diary exists for the day.
func (s *DiaryService) Get(ctx context.Context, userID string, date domain.Date) (*DiaryDetail, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, domain.InvalidUUID(err)
	}

	diary, err := s.diaries.ByDate(ctx, id, date)
	if errors.Is(err, domain.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, domain.Internal(err)
	}

	memos, err := s.diaries.MemosForDate(ctx, id, date)
	if err != nil {
		return nil, domain.Internal(err)
	}

	detail := &DiaryDetail{Diary: diary, Memos: make([]DiaryMemo, 0, len(memos))}
	for _, memo := range memos {
		resources, err := s.diaries.MemoResources(ctx, memo.ID)
		if err != nil {
			return nil, domain.Internal(err)
		}
		detail.Memos = append(detail.Memos, DiaryMemo{Memo: memo, Resources: resources})
	}
	return detail, nil
}

// Create overwrites the day's diary with the supplied summary and mood.
func (s *DiaryService) Create(
	ctx context.Context,
	userID string,
	date domain.Date,
	summary, moodKey string,
	moodScore int32,
) (domain.Diary, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domain.Diary{}, domain.InvalidUUID(err)
	}

	diary, err := s.diaries.Upsert(ctx, id, date, summary, moodKey, moodScore, time.Now().UnixMilli())
	if err != nil {
		return domain.Diary{}, domain.Internal(err)
	}
	return diary, nil
}

// Update applies whichever fields were supplied.
func (s *DiaryService) Update(
	ctx context.Context,
	userID string,
	date domain.Date,
	summary, moodKey *string,
	moodScore *int32,
) (domain.Diary, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domain.Diary{}, domain.InvalidUUID(err)
	}

	diary, err := s.diaries.Update(ctx, id, date, summary, moodKey, moodScore, time.Now().UnixMilli())
	if errors.Is(err, domain.ErrNoRows) {
		return domain.Diary{}, domain.DiaryNotFound()
	}
	if err != nil {
		return domain.Diary{}, domain.Internal(err)
	}
	return diary, nil
}

// UpdateSummary replaces only the day's summary.
func (s *DiaryService) UpdateSummary(
	ctx context.Context,
	userID string,
	date domain.Date,
	summary string,
) (domain.Diary, error) {
	return s.Update(ctx, userID, date, &summary, nil, nil)
}

// UpdateMood replaces only the day's mood.
func (s *DiaryService) UpdateMood(
	ctx context.Context,
	userID string,
	date domain.Date,
	moodKey string,
	moodScore int32,
) (domain.Diary, error) {
	return s.Update(ctx, userID, date, nil, &moodKey, &moodScore)
}
