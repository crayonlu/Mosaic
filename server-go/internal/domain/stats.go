package domain

// HeatMap is the contribution calendar used by the stats screen.
type HeatMap struct {
	Dates      []string  `json:"dates"`
	Counts     []int32   `json:"counts"`
	Moods      []*string `json:"moods"`
	MoodScores []*int32  `json:"moodScores"`
}

// TimelineEntry is one day on the mood timeline.
type TimelineEntry struct {
	Date      string  `json:"date"`
	MoodKey   *string `json:"moodKey"`
	MoodScore *int32  `json:"moodScore"`
	Summary   string  `json:"summary"`
	MemoCount int32   `json:"memoCount"`
	Color     string  `json:"color"`
}

// Timeline is the ordered set of timeline entries.
type Timeline struct {
	Entries []TimelineEntry `json:"entries"`
}

// MoodData is one mood's share of the trend window.
type MoodData struct {
	MoodKey    string  `json:"moodKey"`
	Count      int32   `json:"count"`
	Percentage float32 `json:"percentage"`
}

// TagData is one tag's frequency in the trend window.
type TagData struct {
	Tag   string `json:"tag"`
	Count int32  `json:"count"`
}

// Trends is the mood and tag breakdown.
type Trends struct {
	Moods []MoodData `json:"moods"`
	Tags  []TagData  `json:"tags"`
}

// Summary is the all-time aggregate shown on the profile screen.
type Summary struct {
	TotalMemos     int64 `json:"totalMemos"`
	TotalDiaries   int64 `json:"totalDiaries"`
	TotalResources int64 `json:"totalResources"`
}

// StatsRange is the inclusive date window the stats endpoints accept.
type StatsRange struct {
	StartDate string
	EndDate   string
}
