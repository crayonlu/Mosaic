package service

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

type statsFakeSettings struct {
	location *time.Location
}

func (f statsFakeSettings) Timezone(context.Context) *time.Location { return f.location }

type statsFakeStore struct {
	memos     int64
	diaries   int64
	resources int64
}

func (f *statsFakeStore) DiariesInRange(
	context.Context, uuid.UUID, domain.Date, domain.Date,
) ([]domain.Diary, error) {
	return nil, nil
}

func (f *statsFakeStore) MemoTimestamps(context.Context, uuid.UUID, int64, int64) ([]int64, error) {
	return nil, nil
}

func (f *statsFakeStore) MemosInRange(context.Context, uuid.UUID, int64, int64) ([]domain.Memo, error) {
	return nil, nil
}

func (f *statsFakeStore) MoodCounts(
	context.Context, uuid.UUID, domain.Date, domain.Date,
) ([]domain.MoodData, error) {
	return nil, nil
}

func (f *statsFakeStore) TagCounts(context.Context, uuid.UUID, int64, int64) ([]domain.TagData, error) {
	return nil, nil
}

func (f *statsFakeStore) SummaryTotals(
	context.Context, uuid.UUID, int32, int32, int64, int64,
) (int64, int64, int64, error) {
	return f.memos, f.diaries, f.resources, nil
}

func TestBuildHeatMapFillsGaps(t *testing.T) {
	start := diaryTestDate(2026, time.January, 1)
	end := diaryTestDate(2026, time.January, 4)
	moods := map[string]statsDayMood{"2026-01-02": {key: "joy", score: 7}}
	counts := map[string]int32{"2026-01-02": 3, "2026-01-04": 1}

	heat := buildHeatMap(start, end, moods, counts)

	if len(heat.Dates) != 4 || len(heat.Counts) != 4 || len(heat.Moods) != 4 || len(heat.MoodScores) != 4 {
		t.Fatalf("array lengths = (%d, %d, %d, %d), want all 4",
			len(heat.Dates), len(heat.Counts), len(heat.Moods), len(heat.MoodScores))
	}
	if heat.Dates[0] != "2026-01-01" || heat.Dates[3] != "2026-01-04" {
		t.Errorf("dates = %v, want an inclusive 01-01..01-04 range", heat.Dates)
	}
	if heat.Counts[0] != 0 || heat.Moods[0] != nil || heat.MoodScores[0] != nil {
		t.Errorf("day with no activity = (%d, %v, %v), want zero and nils",
			heat.Counts[0], heat.Moods[0], heat.MoodScores[0])
	}
	if heat.Moods[1] == nil || *heat.Moods[1] != "joy" || heat.MoodScores[1] == nil || *heat.MoodScores[1] != 7 {
		t.Errorf("seeded day = (%v, %v), want joy and 7", heat.Moods[1], heat.MoodScores[1])
	}
	if heat.Moods[2] != nil {
		t.Errorf("gap day mood = %v, want nil", heat.Moods[2])
	}
	if heat.Counts[3] != 1 {
		t.Errorf("last count = %d, want 1", heat.Counts[3])
	}
}

func TestBuildTimelineOrdersNewestFirst(t *testing.T) {
	counts := map[string]int32{"2026-01-01": 2, "2026-01-03": 5}
	diaries := map[string]domain.Diary{
		"2026-01-03": {MoodKey: "joy", MoodScore: 9, Summary: "hi"},
	}

	timeline := buildTimeline(counts, diaries)
	if len(timeline.Entries) != 2 {
		t.Fatalf("entries = %d, want 2", len(timeline.Entries))
	}

	newest := timeline.Entries[0]
	if newest.Date != "2026-01-03" || newest.MemoCount != 5 {
		t.Errorf("newest entry = %+v, want 2026-01-03 with 5 memos", newest)
	}
	if newest.MoodKey == nil || *newest.MoodKey != "joy" || newest.MoodScore == nil || *newest.MoodScore != 9 {
		t.Errorf("newest mood = (%v, %v), want joy and 9", newest.MoodKey, newest.MoodScore)
	}
	if newest.Color != "#FFD93D" {
		t.Errorf("joy color = %q, want #FFD93D", newest.Color)
	}
	if newest.Summary != "hi" {
		t.Errorf("summary = %q, want hi", newest.Summary)
	}

	oldest := timeline.Entries[1]
	if oldest.Date != "2026-01-01" || oldest.MoodKey != nil || oldest.Color != "#8b5cf6" {
		t.Errorf("oldest entry = %+v, want a moodless default-coloured day", oldest)
	}
}

func TestMoodPercentagesSumTo100(t *testing.T) {
	moods := moodPercentages([]domain.MoodData{
		{MoodKey: "joy", Count: 3},
		{MoodKey: "calm", Count: 1},
	})

	if len(moods) != 2 {
		t.Fatalf("moods = %d, want 2", len(moods))
	}
	if moods[0].Percentage != 75 || moods[1].Percentage != 25 {
		t.Errorf("percentages = (%v, %v), want (75, 25)", moods[0].Percentage, moods[1].Percentage)
	}

	var sum float32
	for _, mood := range moodPercentages([]domain.MoodData{
		{MoodKey: "a", Count: 1}, {MoodKey: "b", Count: 1}, {MoodKey: "c", Count: 1},
	}) {
		sum += mood.Percentage
	}
	if sum < 99.9 || sum > 100.1 {
		t.Errorf("percentage sum = %v, want ~100", sum)
	}
}

func TestResolveTimezoneFallsBackToShanghai(t *testing.T) {
	_, offset := time.Now().In(resolveTimezone("Asia/Shanghai")).Zone()
	if offset != 8*60*60 {
		t.Errorf("Asia/Shanghai offset = %d, want 28800", offset)
	}

	_, fallbackOffset := time.Now().In(resolveTimezone("Not/ARealZone")).Zone()
	if fallbackOffset != 8*60*60 {
		t.Errorf("fallback offset = %d, want 28800", fallbackOffset)
	}
}

func TestDateAndMonthBounds(t *testing.T) {
	location := time.FixedZone("Asia/Shanghai", 8*60*60)

	ms := dateToMillis(diaryTestDate(2026, time.January, 1), location)
	if got := dateFromMillis(ms, location).String(); got != "2026-01-01" {
		t.Errorf("round trip date = %s, want 2026-01-01", got)
	}

	start, end := monthBounds(2026, 12, location)
	if got := dateFromMillis(start, location).String(); got != "2026-12-01" {
		t.Errorf("month start = %s, want 2026-12-01", got)
	}
	if got := dateFromMillis(end, location).String(); got != "2027-01-01" {
		t.Errorf("month end = %s, want 2027-01-01", got)
	}
}

func TestStatsServiceSummaryUsesStoreTotals(t *testing.T) {
	store := &statsFakeStore{memos: 5, diaries: 3, resources: 2}
	svc := NewStatsService(store, statsFakeSettings{location: time.UTC})

	summary, err := svc.Summary(context.Background(), uuid.New().String(), 2026, 1)
	if err != nil {
		t.Fatalf("Summary: %v", err)
	}
	if summary.TotalMemos != 5 || summary.TotalDiaries != 3 || summary.TotalResources != 2 {
		t.Errorf("summary = %+v, want 5/3/2", summary)
	}
}
