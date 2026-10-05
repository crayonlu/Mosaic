package service

import (
	"context"
	"sort"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// StatsStore is the persistence the stats service depends on.
type StatsStore interface {
	DiariesInRange(ctx context.Context, userID uuid.UUID, start, end domain.Date) ([]domain.Diary, error)
	MemoTimestamps(ctx context.Context, userID uuid.UUID, startMs, endMs int64) ([]int64, error)
	MemosInRange(ctx context.Context, userID uuid.UUID, startMs, endMs int64) ([]domain.Memo, error)
	MoodCounts(ctx context.Context, userID uuid.UUID, start, end domain.Date) ([]domain.MoodData, error)
	TagCounts(ctx context.Context, userID uuid.UUID, startMs, endMs int64) ([]domain.TagData, error)
	SummaryTotals(ctx context.Context, userID uuid.UUID, year, month int32, startMs, endMs int64) (int64, int64, int64, error)
}

// StatsSettings resolves the timezone the stats windows are measured in. It is
// read at query time, so a settings change takes effect immediately.
type StatsSettings interface {
	Timezone(ctx context.Context) *time.Location
}

// StatsService implements the stats endpoints.
type StatsService struct {
	stats    StatsStore
	settings StatsSettings
}

func NewStatsService(stats StatsStore, settings StatsSettings) *StatsService {
	return &StatsService{stats: stats, settings: settings}
}

// statsDayMood is a single day's diary mood.
type statsDayMood struct {
	key   string
	score int32
}

// HeatMap returns one entry per day in the inclusive range, including days with
// no activity, so the four arrays always share a length.
func (s *StatsService) HeatMap(
	ctx context.Context,
	userID string,
	start, end domain.Date,
) (domain.HeatMap, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domain.HeatMap{}, domain.InvalidUUID(err)
	}

	location := s.settings.Timezone(ctx)
	diaries, err := s.stats.DiariesInRange(ctx, id, start, end)
	if err != nil {
		return domain.HeatMap{}, domain.Internal(err)
	}
	moods := make(map[string]statsDayMood, len(diaries))
	for _, diary := range diaries {
		moods[diary.Date.String()] = statsDayMood{key: diary.MoodKey, score: diary.MoodScore}
	}

	timestamps, err := s.stats.MemoTimestamps(
		ctx, id, dateToMillis(start, location), dateToMillis(nextDay(end), location))
	if err != nil {
		return domain.HeatMap{}, domain.Internal(err)
	}
	counts := make(map[string]int32, len(timestamps))
	for _, ts := range timestamps {
		counts[dateFromMillis(ts, location).String()]++
	}

	return buildHeatMap(start, end, moods, counts), nil
}

// Timeline returns the days with memos, newest first.
func (s *StatsService) Timeline(
	ctx context.Context,
	userID string,
	start, end domain.Date,
) (domain.Timeline, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domain.Timeline{}, domain.InvalidUUID(err)
	}

	location := s.settings.Timezone(ctx)
	diaries, err := s.stats.DiariesInRange(ctx, id, start, end)
	if err != nil {
		return domain.Timeline{}, domain.Internal(err)
	}
	byDate := make(map[string]domain.Diary, len(diaries))
	for _, diary := range diaries {
		byDate[diary.Date.String()] = diary
	}

	memos, err := s.stats.MemosInRange(
		ctx, id, dateToMillis(start, location), dateToMillis(nextDay(end), location))
	if err != nil {
		return domain.Timeline{}, domain.Internal(err)
	}
	memoCounts := make(map[string]int32, len(memos))
	for _, memo := range memos {
		memoCounts[dateFromMillis(memo.CreatedAt, location).String()]++
	}

	return buildTimeline(memoCounts, byDate), nil
}

// Trends returns the mood and tag breakdown for the range.
func (s *StatsService) Trends(
	ctx context.Context,
	userID string,
	start, end domain.Date,
) (domain.Trends, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domain.Trends{}, domain.InvalidUUID(err)
	}

	location := s.settings.Timezone(ctx)
	moods, err := s.stats.MoodCounts(ctx, id, start, end)
	if err != nil {
		return domain.Trends{}, domain.Internal(err)
	}
	tags, err := s.stats.TagCounts(
		ctx, id, dateToMillis(start, location), dateToMillis(nextDay(end), location))
	if err != nil {
		return domain.Trends{}, domain.Internal(err)
	}

	return domain.Trends{Moods: moodPercentages(moods), Tags: nonNilTrendTags(tags)}, nil
}

// Summary returns a month's totals.
func (s *StatsService) Summary(
	ctx context.Context,
	userID string,
	year, month int32,
) (domain.Summary, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domain.Summary{}, domain.InvalidUUID(err)
	}

	startMs, endMs := monthBounds(year, month, s.settings.Timezone(ctx))
	memos, diaries, resources, err := s.stats.SummaryTotals(ctx, id, year, month, startMs, endMs)
	if err != nil {
		return domain.Summary{}, domain.Internal(err)
	}

	return domain.Summary{
		TotalMemos:     memos,
		TotalDiaries:   diaries,
		TotalResources: resources,
	}, nil
}

// buildHeatMap fills every day in [start, end] with its memo count and optional
// mood. It performs no I/O and is unit tested directly.
func buildHeatMap(
	start, end domain.Date,
	moods map[string]statsDayMood,
	counts map[string]int32,
) domain.HeatMap {
	heat := domain.HeatMap{
		Dates:      []string{},
		Counts:     []int32{},
		Moods:      []*string{},
		MoodScores: []*int32{},
	}

	for day := start; !day.Time.After(end.Time); day = nextDay(day) {
		date := day.String()
		heat.Dates = append(heat.Dates, date)
		heat.Counts = append(heat.Counts, counts[date])

		if mood, ok := moods[date]; ok {
			key := mood.key
			score := mood.score
			heat.Moods = append(heat.Moods, &key)
			heat.MoodScores = append(heat.MoodScores, &score)
			continue
		}
		heat.Moods = append(heat.Moods, nil)
		heat.MoodScores = append(heat.MoodScores, nil)
	}
	return heat
}

// buildTimeline orders the days that carry memos, newest first, and joins each
// to its diary and mood colour.
func buildTimeline(
	memoCounts map[string]int32,
	diaries map[string]domain.Diary,
) domain.Timeline {
	dates := make([]string, 0, len(memoCounts))
	for date := range memoCounts {
		dates = append(dates, date)
	}
	sort.Sort(sort.Reverse(sort.StringSlice(dates)))

	entries := make([]domain.TimelineEntry, 0, len(dates))
	for _, date := range dates {
		entry := domain.TimelineEntry{Date: date, MemoCount: memoCounts[date]}
		if diary, ok := diaries[date]; ok {
			moodKey := diary.MoodKey
			moodScore := diary.MoodScore
			entry.MoodKey = &moodKey
			entry.MoodScore = &moodScore
			entry.Summary = diary.Summary
		}
		entry.Color = statsMoodColor(entry.MoodKey)
		entries = append(entries, entry)
	}
	return domain.Timeline{Entries: entries}
}

// statsMoodColor maps a mood key to the colour the client renders, matching the
// previous server's palette.
func statsMoodColor(moodKey *string) string {
	if moodKey == nil {
		return "#8b5cf6"
	}
	switch *moodKey {
	case "joy":
		return "#FFD93D"
	case "sadness":
		return "#4ECDC4"
	case "anger":
		return "#FF6B6B"
	case "anxiety":
		return "#FFA07A"
	case "calm":
		return "#95E1D3"
	case "focus":
		return "#6C5CE7"
	case "tired":
		return "#A8A8A8"
	default:
		return "#8b5cf6"
	}
}

// moodPercentages converts mood counts into shares of the total, summing to
// 100 (within float precision) when any mood is present.
func moodPercentages(moods []domain.MoodData) []domain.MoodData {
	var total int32
	for _, mood := range moods {
		total += mood.Count
	}

	result := make([]domain.MoodData, len(moods))
	for i, mood := range moods {
		if total > 0 {
			mood.Percentage = float32(mood.Count) / float32(total) * 100
		}
		result[i] = mood
	}
	return result
}

func nonNilTrendTags(tags []domain.TagData) []domain.TagData {
	if tags == nil {
		return []domain.TagData{}
	}
	return tags
}

// nextDay returns the calendar day after d.
func nextDay(d domain.Date) domain.Date {
	return domain.NewDate(d.Time.AddDate(0, 0, 1))
}

// dateToMillis returns midnight of the calendar day in location, as epoch
// milliseconds.
func dateToMillis(date domain.Date, location *time.Location) int64 {
	year, month, day := date.Time.Date()
	return time.Date(year, month, day, 0, 0, 0, 0, location).UnixMilli()
}

// dateFromMillis returns the calendar day a timestamp falls on in location.
func dateFromMillis(ms int64, location *time.Location) domain.Date {
	return domain.NewDate(time.UnixMilli(ms).In(location))
}

// monthBounds returns the [start, end) epoch-millisecond window of a month in
// location.
func monthBounds(year, month int32, location *time.Location) (int64, int64) {
	start := time.Date(int(year), time.Month(month), 1, 0, 0, 0, 0, location)
	return start.UnixMilli(), start.AddDate(0, 1, 0).UnixMilli()
}
