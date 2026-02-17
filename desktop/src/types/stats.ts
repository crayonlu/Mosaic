// Re-export types from @mosaic/api shared package
export type {
  MoodData,
  StatsQuery,
  SummaryData,
  SummaryQuery,
  TagData,
  TimelineData,
  TimelineEntry,
  TrendsData,
  PaginatedResponse
} from '@mosaic/api'

// Desktop-specific HeatMapCell type (not in shared package)
export interface HeatMapCell {
  date: string
  count: number
  color: string
  isToday: boolean
  moodKey?: string
  moodScore?: number
}

// Desktop-specific extended HeatMapData with cells (not in shared package)
export interface HeatMapData {
  dates: string[]
  counts: number[]
  moods?: (string | null)[]
  moodScores?: (number | null)[]
  cells?: HeatMapCell[]
  startDate?: string
  endDate?: string
}

