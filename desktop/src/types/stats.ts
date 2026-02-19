// Re-export types from @mosaic/api shared package
export type {
  HeatMapData,
  MoodData,
  StatsQuery,
  SummaryData,
  SummaryQuery,
  TagData,
  TimelineData,
  TimelineEntry,
  TrendsData,
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

// Extended HeatMapData with cells for desktop UI
export interface HeatMapDataExtended {
  dates: string[]
  counts: number[]
  moods?: (string | null)[]
  moodScores?: (number | null)[]
  cells?: HeatMapCell[]
  startDate?: string
  endDate?: string
}

// Re-export common types
export type { PaginatedResponse } from '@mosaic/api'
