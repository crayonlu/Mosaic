export interface HeatMapQuery {
  startDate: string
  endDate: string
}

export interface HeatMapCell {
  date: string
  moodKey?: string
  moodScore?: number
  color: string
}

export interface HeatMapData {
  startDate: string
  endDate: string
  cells: HeatMapCell[]
}

export interface TimelineQuery {
  startDate: string
  endDate: string
}

export interface TimelineEntry {
  date: string
  moodKey?: string
  moodScore?: number
  summary: string
  memoCount: number
  color: string
}

export interface TimelineData {
  entries: TimelineEntry[]
}

export interface TrendsQuery {
  startDate: string
  endDate: string
}

export interface TrendPoint {
  date: string
  moodScore?: number
  color: string
}

export interface TrendsData {
  points: TrendPoint[]
  avgScore: number
  maxScore: number
  minScore: number
}

export interface SummaryQuery {
  year: number
  month: number
}

export interface MoodStats {
  moodKey: string
  count: number
  percentage: number
  color: string
}

export interface TagStats {
  tag: string
  count: number
}

export interface SummaryData {
  year: number
  month: number
  totalDays: number
  recordedDays: number
  avgMoodScore: number
  moodDistribution: MoodStats[]
  topTags: TagStats[]
  dominantMood?: string
}
