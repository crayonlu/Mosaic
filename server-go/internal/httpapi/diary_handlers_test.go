package httpapi

import (
	"context"
	"net/http"
	"sort"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/auth"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

const httpTestSecret = "httpapi-segment-test-secret"

// newAuthedTestRouter mounts register behind the real bearer-token middleware,
// so requests exercise the same authentication path as production.
func newAuthedTestRouter(t *testing.T, userID uuid.UUID, register func(chi.Router)) (http.Handler, string) {
	t.Helper()
	token, err := auth.Sign(httpTestSecret, userID.String(), domain.RoleUser, false, time.Hour)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	router := chi.NewRouter()
	router.Group(func(api chi.Router) {
		api.Use(RequireAuth(httpTestSecret))
		register(api)
	})
	return router, token
}

func httpTestDate(year int, month time.Month, day int) domain.Date {
	return domain.NewDate(time.Date(year, month, day, 0, 0, 0, 0, time.UTC))
}

// httpFakeDiaryStore is an in-memory service.DiaryStore.
type httpFakeDiaryStore struct {
	diaries   []domain.Diary
	memos     map[string][]domain.Memo
	resources map[uuid.UUID][]domain.Resource
}

func newHTTPFakeDiaryStore() *httpFakeDiaryStore {
	return &httpFakeDiaryStore{
		memos:     map[string][]domain.Memo{},
		resources: map[uuid.UUID][]domain.Resource{},
	}
}

func (f *httpFakeDiaryStore) List(
	_ context.Context,
	_ uuid.UUID,
	page, pageSize uint32,
	_, _ *domain.Date,
) ([]domain.Diary, int64, error) {
	sorted := append([]domain.Diary{}, f.diaries...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Date.Time.After(sorted[j].Date.Time) })

	total := int64(len(sorted))
	offset := int(page-1) * int(pageSize)
	if offset >= len(sorted) {
		return []domain.Diary{}, total, nil
	}
	upper := offset + int(pageSize)
	if upper > len(sorted) {
		upper = len(sorted)
	}
	return sorted[offset:upper], total, nil
}

func (f *httpFakeDiaryStore) ByDate(_ context.Context, _ uuid.UUID, date domain.Date) (domain.Diary, error) {
	for _, diary := range f.diaries {
		if diary.Date.String() == date.String() {
			return diary, nil
		}
	}
	return domain.Diary{}, domain.ErrNoRows
}

func (f *httpFakeDiaryStore) MemosForDate(
	_ context.Context,
	_ uuid.UUID,
	date domain.Date,
) ([]domain.Memo, error) {
	return f.memos[date.String()], nil
}

func (f *httpFakeDiaryStore) MemoResources(_ context.Context, memoID uuid.UUID) ([]domain.Resource, error) {
	return f.resources[memoID], nil
}

func (f *httpFakeDiaryStore) Upsert(
	_ context.Context,
	userID uuid.UUID,
	date domain.Date,
	summary, moodKey string,
	moodScore int32,
	now int64,
) (domain.Diary, error) {
	for i, diary := range f.diaries {
		if diary.Date.String() == date.String() {
			diary.Summary, diary.MoodKey, diary.MoodScore = summary, moodKey, moodScore
			diary.GenerationSource, diary.AutoGenerationLocked = domain.GenerationSourceManual, true
			diary.UpdatedAt = now
			f.diaries[i] = diary
			return diary, nil
		}
	}
	diary := domain.Diary{
		Date: date, UserID: userID, Summary: summary, MoodKey: moodKey, MoodScore: moodScore,
		GenerationSource: domain.GenerationSourceManual, AutoGenerationLocked: true,
		GeneratedFromMemoIDs: []uuid.UUID{}, CreatedAt: now, UpdatedAt: now,
	}
	f.diaries = append(f.diaries, diary)
	return diary, nil
}

func (f *httpFakeDiaryStore) Update(
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
		diary.GenerationSource, diary.AutoGenerationLocked = domain.GenerationSourceManual, true
		diary.UpdatedAt = now
		f.diaries[i] = diary
		return diary, nil
	}
	return domain.Diary{}, domain.ErrNoRows
}

func TestDiaryHTTPCreateUpdateRoundTrip(t *testing.T) {
	store := newHTTPFakeDiaryStore()
	router, token := newAuthedTestRouter(t, uuid.New(), func(r chi.Router) {
		registerDiaryRoutes(r, service.NewDiaryService(store))
	})

	create := doJSON(t, router, http.MethodPost, "/diaries/2026-02-24",
		`{"summary":"first","moodKey":"joy","moodScore":8}`, token)
	if create.Code != http.StatusOK {
		t.Fatalf("create status = %d, want 200 (body %s)", create.Code, create.Body)
	}
	var created diaryResponse
	decodeBody(t, create, &created)
	if created.Date != "2026-02-24" || created.Summary != "first" || created.MoodKey != "joy" ||
		created.MoodScore != 8 {
		t.Errorf("created = %+v", created)
	}
	if created.GenerationSource != domain.GenerationSourceManual || !created.AutoGenerationLocked {
		t.Errorf("created entry is not a locked manual write: %+v", created)
	}

	summary := doJSON(t, router, http.MethodPut, "/diaries/2026-02-24/summary",
		`{"summary":"second"}`, token)
	if summary.Code != http.StatusOK {
		t.Fatalf("summary status = %d, want 200 (body %s)", summary.Code, summary.Body)
	}
	var summarized diaryResponse
	decodeBody(t, summary, &summarized)
	if summarized.Summary != "second" || summarized.MoodScore != 8 {
		t.Errorf("after summary update = %+v, want summary second and score 8", summarized)
	}

	mood := doJSON(t, router, http.MethodPut, "/diaries/2026-02-24/mood",
		`{"moodKey":"calm","moodScore":3}`, token)
	if mood.Code != http.StatusOK {
		t.Fatalf("mood status = %d, want 200 (body %s)", mood.Code, mood.Body)
	}
	var mooded diaryResponse
	decodeBody(t, mood, &mooded)
	if mooded.MoodKey != "calm" || mooded.MoodScore != 3 || mooded.Summary != "second" {
		t.Errorf("after mood update = %+v, want calm/3 and summary second", mooded)
	}

	fetched := doJSON(t, router, http.MethodGet, "/diaries/2026-02-24", "", token)
	var detail diaryWithMemosResponse
	decodeBody(t, fetched, &detail)
	if detail.Summary != "second" || detail.MoodKey != "calm" {
		t.Errorf("reloaded diary = %+v, want the persisted values", detail)
	}
}

func TestDiaryHTTPGetMissingReturnsNull(t *testing.T) {
	router, token := newAuthedTestRouter(t, uuid.New(), func(r chi.Router) {
		registerDiaryRoutes(r, service.NewDiaryService(newHTTPFakeDiaryStore()))
	})

	rec := doJSON(t, router, http.MethodGet, "/diaries/2026-01-01", "", token)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if got := rec.Body.String(); got != "null" {
		t.Errorf("body = %q, want null", got)
	}
}

func TestDiaryHTTPGetIncludesMemosAndResources(t *testing.T) {
	store := newHTTPFakeDiaryStore()
	date := httpTestDate(2026, time.March, 5)
	store.diaries = append(store.diaries, domain.Diary{
		Date: date, Summary: "day", MoodKey: "focus", MoodScore: 6,
	})
	memoID, resourceID := uuid.New(), uuid.New()
	store.memos[date.String()] = []domain.Memo{{ID: memoID, Content: "note", Tags: []string{"work"}}}
	store.resources[memoID] = []domain.Resource{{ID: resourceID, Filename: "photo.jpg", MimeType: "image/jpeg"}}

	router, token := newAuthedTestRouter(t, uuid.New(), func(r chi.Router) {
		registerDiaryRoutes(r, service.NewDiaryService(store))
	})

	rec := doJSON(t, router, http.MethodGet, "/diaries/2026-03-05", "", token)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}
	var detail diaryWithMemosResponse
	decodeBody(t, rec, &detail)
	if len(detail.Memos) != 1 {
		t.Fatalf("memos = %d, want 1", len(detail.Memos))
	}
	if detail.Memos[0].ID != memoID.String() || len(detail.Memos[0].Resources) != 1 {
		t.Fatalf("memo = %+v, want one resource", detail.Memos[0])
	}
	wantURL := "/api/resources/" + resourceID.String() + "/download"
	if got := detail.Memos[0].Resources[0].URL; got != wantURL {
		t.Errorf("resource url = %q, want %q", got, wantURL)
	}
}

func TestDiaryHTTPListPaginationEnvelope(t *testing.T) {
	store := newHTTPFakeDiaryStore()
	for day := 1; day <= 3; day++ {
		store.diaries = append(store.diaries, domain.Diary{
			Date: httpTestDate(2026, time.February, day), Summary: "entry", MoodKey: "joy", MoodScore: 5,
		})
	}
	router, token := newAuthedTestRouter(t, uuid.New(), func(r chi.Router) {
		registerDiaryRoutes(r, service.NewDiaryService(store))
	})

	rec := doJSON(t, router, http.MethodGet, "/diaries?page=2&pageSize=2", "", token)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}
	var page domain.Paginated[diaryResponse]
	decodeBody(t, rec, &page)
	if page.Total != 3 || page.Page != 2 || page.PageSize != 2 || page.TotalPages != 2 {
		t.Errorf("envelope = total %d, page %d, pageSize %d, totalPages %d; want 3/2/2/2",
			page.Total, page.Page, page.PageSize, page.TotalPages)
	}
	if len(page.Items) != 1 {
		t.Errorf("items = %d, want 1 on the second page", len(page.Items))
	}

	// An omitted page decays to the documented default.
	rec = doJSON(t, router, http.MethodGet, "/diaries", "", token)
	decodeBody(t, rec, &page)
	if page.Page != 1 || page.PageSize != 20 || page.TotalPages != 1 {
		t.Errorf("default envelope = page %d, pageSize %d, totalPages %d; want 1/20/1",
			page.Page, page.PageSize, page.TotalPages)
	}
}

func TestDiaryHTTPRejectsBadMoodScore(t *testing.T) {
	router, token := newAuthedTestRouter(t, uuid.New(), func(r chi.Router) {
		registerDiaryRoutes(r, service.NewDiaryService(newHTTPFakeDiaryStore()))
	})

	rec := doJSON(t, router, http.MethodPost, "/diaries/2026-02-24",
		`{"summary":"x","moodKey":"joy","moodScore":0}`, token)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body %s)", rec.Code, rec.Body)
	}
	var body errorBody
	decodeBody(t, rec, &body)
	if body.Message != "Invalid input: moodScore must be between 1 and 10" {
		t.Errorf("message = %q", body.Message)
	}
}

func TestDiaryHTTPRejectsInvalidDate(t *testing.T) {
	router, token := newAuthedTestRouter(t, uuid.New(), func(r chi.Router) {
		registerDiaryRoutes(r, service.NewDiaryService(newHTTPFakeDiaryStore()))
	})

	rec := doJSON(t, router, http.MethodGet, "/diaries/not-a-date", "", token)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body %s)", rec.Code, rec.Body)
	}
}
