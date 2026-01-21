export interface HeatMapQuery {
  startDate: string
  endDate: string
}

export interface HeatMapData {
  dates: string[]
  counts: number[]
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

export interface MoodData {
  moodKey: string
  count: number
  percentage: number
}

export interface TagData {
  tag: string
  count: number
}

export interface TrendsData {
  moods: MoodData[]
  tags: TagData[]
}

export interface SummaryQuery {
  year: number
  month: number
}

export interface SummaryData {
  totalMemos: number
  totalDiaries: number
  totalResources: number
}
