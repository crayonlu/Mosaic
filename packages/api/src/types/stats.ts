import type { MoodKey } from './diaries'

export interface StatsQuery {
  start_date: string
  end_date: string
  [key: string]: unknown
}

export interface SummaryQuery {
  year: number
  month: number
  [key: string]: unknown
}

export interface HeatMapData {
  dates: string[]
  counts: number[]
  moods: (MoodKey | null)[]
  moodScores: (number | null)[]
}

export interface TimelineEntry {
  date: string
  moodKey: MoodKey | null
  moodScore: number | null
  summary: string
  memoCount: number
  color: string
}

export interface TimelineData {
  entries: TimelineEntry[]
}

export interface MoodData {
  moodKey: MoodKey
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

export interface SummaryData {
  totalMemos: number
  totalDiaries: number
  totalResources: number
}
