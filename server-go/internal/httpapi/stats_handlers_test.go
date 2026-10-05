package httpapi

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// httpFakeStatsStore is an in-memory service.StatsStore.
type httpFakeStatsStore struct {
	diaries     []domain.Diary
	timestamps  []int64
	memos       []domain.Memo
	moods       []domain.MoodData
	tags        []domain.TagData
	totalMemos  int64
	totalDiary  int64
	totalShared int64
}

func (f *httpFakeStatsStore) DiariesInRange(
	context.Context, uuid.UUID, domain.Date, domain.Date,
) ([]domain.Diary, error) {
	return f.diaries, nil
}

func (f *httpFakeStatsStore) MemoTimestamps(context.Context, uuid.UUID, int64, int64) ([]int64, error) {
	return f.timestamps, nil
}

func (f *httpFakeStatsStore) MemosInRange(context.Context, uuid.UUID, int64, int64) ([]domain.Memo, error) {
	return f.memos, nil
}

func (f *httpFakeStatsStore) MoodCounts(
	context.Context, uuid.UUID, domain.Date, domain.Date,
) ([]domain.MoodData, error) {
	return f.moods, nil
}

func (f *httpFakeStatsStore) TagCounts(context.Context, uuid.UUID, int64, int64) ([]domain.TagData, error) {
	return f.tags, nil
}

func (f *httpFakeStatsStore) SummaryTotals(
	context.Context, uuid.UUID, int32, int32, int64, int64,
) (int64, int64, int64, error) {
	return f.totalMemos, f.totalDiary, f.totalShared, nil
}

type httpFakeStatsSettings struct {
	location *time.Location
}

func (f httpFakeStatsSettings) Timezone(context.Context) *time.Location { return f.location }

func newStatsTestRouter(
	t *testing.T,
	store service.StatsStore,
) (http.Handler, string) {
	t.Helper()
	location := time.FixedZone("Asia/Shanghai", 8*60*60)
	svc := service.NewStatsService(store, httpFakeStatsSettings{location: location})
	return newAuthedTestRouter(t, uuid.New(), func(r chi.Router) {
		registerStatsRoutes(r, svc)
	})
}

func shanghaiMillis(year int, month time.Month, day, hour int) int64 {
	location := time.FixedZone("Asia/Shanghai", 8*60*60)
	return time.Date(year, month, day, hour, 0, 0, 0, location).UnixMilli()
}

func TestStatsHTTPHeatmapIsDateFilled(t *testing.T) {
	store := &httpFakeStatsStore{
		diaries: []domain.Diary{{
			Date: httpTestDate(2026, time.January, 2), MoodKey: "joy", MoodScore: 7,
		}},
		timestamps: []int64{
			shanghaiMillis(2026, time.January, 2, 12),
			shanghaiMillis(2026, time.January, 4, 9),
		},
	}
	router, token := newStatsTestRouter(t, store)

	rec := doJSON(t, router, http.MethodGet,
		"/stats/heatmap?startDate=2026-01-01&endDate=2026-01-04", "", token)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}

	var heat domain.HeatMap
	decodeBody(t, rec, &heat)
	if len(heat.Dates) != 4 || len(heat.Counts) != 4 || len(heat.Moods) != 4 || len(heat.MoodScores) != 4 {
		t.Fatalf("array lengths = (%d, %d, %d, %d), want all 4",
			len(heat.Dates), len(heat.Counts), len(heat.Moods), len(heat.MoodScores))
	}
	if heat.Dates[0] != "2026-01-01" || heat.Dates[3] != "2026-01-04" {
		t.Errorf("dates = %v, want the inclusive range", heat.Dates)
	}
	if heat.Counts[0] != 0 || heat.Moods[0] != nil || heat.MoodScores[0] != nil {
		t.Errorf("empty day = (%d, %v, %v), want 0 and nils", heat.Counts[0], heat.Moods[0], heat.MoodScores[0])
	}
	if heat.Counts[1] != 1 || heat.Moods[1] == nil || *heat.Moods[1] != "joy" ||
		heat.MoodScores[1] == nil || *heat.MoodScores[1] != 7 {
		t.Errorf("seeded day = count %d mood %v score %v, want 1/joy/7",
			heat.Counts[1], heat.Moods[1], heat.MoodScores[1])
	}
	if heat.Counts[3] != 1 || heat.Moods[3] != nil {
		t.Errorf("memo-only day = count %d mood %v, want 1 and nil", heat.Counts[3], heat.Moods[3])
	}
}

func TestStatsHTTPTimelineOrdersAndColours(t *testing.T) {
	store := &httpFakeStatsStore{
		memos: []domain.Memo{
			{CreatedAt: shanghaiMillis(2026, time.January, 3, 10)},
			{CreatedAt: shanghaiMillis(2026, time.January, 1, 10)},
		},
		diaries: []domain.Diary{{
			Date: httpTestDate(2026, time.January, 3), MoodKey: "anger", MoodScore: 2, Summary: "hard day",
		}},
	}
	router, token := newStatsTestRouter(t, store)

	rec := doJSON(t, router, http.MethodGet,
		"/stats/timeline?startDate=2026-01-01&endDate=2026-01-04", "", token)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}

	var timeline domain.Timeline
	decodeBody(t, rec, &timeline)
	if len(timeline.Entries) != 2 {
		t.Fatalf("entries = %d, want 2", len(timeline.Entries))
	}
	newest := timeline.Entries[0]
	if newest.Date != "2026-01-03" || newest.Color != "#FF6B6B" || newest.Summary != "hard day" {
		t.Errorf("newest = %+v, want 2026-01-03 anger with its summary", newest)
	}
	if newest.MoodKey == nil || *newest.MoodKey != "anger" || newest.MemoCount != 1 {
		t.Errorf("newest mood/count = %v/%d, want anger/1", newest.MoodKey, newest.MemoCount)
	}
	if oldest := timeline.Entries[1]; oldest.Date != "2026-01-01" || oldest.MoodKey != nil {
		t.Errorf("oldest = %+v, want a moodless 2026-01-01", oldest)
	}
}

func TestStatsHTTPTrendsPercentages(t *testing.T) {
	store := &httpFakeStatsStore{
		moods: []domain.MoodData{{MoodKey: "joy", Count: 3}, {MoodKey: "calm", Count: 1}},
		tags:  []domain.TagData{{Tag: "work", Count: 4}},
	}
	router, token := newStatsTestRouter(t, store)

	rec := doJSON(t, router, http.MethodGet,
		"/stats/trends?startDate=2026-01-01&endDate=2026-01-31", "", token)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}

	var trends domain.Trends
	decodeBody(t, rec, &trends)
	if len(trends.Moods) != 2 {
		t.Fatalf("moods = %d, want 2", len(trends.Moods))
	}
	var sum float32
	for _, mood := range trends.Moods {
		sum += mood.Percentage
	}
	if sum < 99.9 || sum > 100.1 {
		t.Errorf("percentage sum = %v, want ~100", sum)
	}
	if trends.Moods[0].Percentage != 75 || trends.Moods[1].Percentage != 25 {
		t.Errorf("percentages = (%v, %v), want (75, 25)",
			trends.Moods[0].Percentage, trends.Moods[1].Percentage)
	}
	if len(trends.Tags) != 1 || trends.Tags[0].Tag != "work" || trends.Tags[0].Count != 4 {
		t.Errorf("tags = %+v, want one work tag with count 4", trends.Tags)
	}
}

func TestStatsHTTPSummaryReflectsSeededCounts(t *testing.T) {
	store := &httpFakeStatsStore{totalMemos: 50, totalDiary: 20, totalShared: 100}
	router, token := newStatsTestRouter(t, store)

	rec := doJSON(t, router, http.MethodGet, "/stats/summary?year=2026&month=1", "", token)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}

	var summary domain.Summary
	decodeBody(t, rec, &summary)
	if summary.TotalMemos != 50 || summary.TotalDiaries != 20 || summary.TotalResources != 100 {
		t.Errorf("summary = %+v, want 50/20/100", summary)
	}
}

func TestStatsHTTPRequiresDateRange(t *testing.T) {
	router, token := newStatsTestRouter(t, &httpFakeStatsStore{})

	rec := doJSON(t, router, http.MethodGet, "/stats/heatmap", "", token)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body %s)", rec.Code, rec.Body)
	}
	var body errorBody
	decodeBody(t, rec, &body)
	if body.Message != "Invalid input: Invalid startDate format, expected YYYY-MM-DD" {
		t.Errorf("message = %q", body.Message)
	}
}
