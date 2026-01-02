import type { MemoWithResources } from './memo'

/**
 * Chart and Statistics Types
 * Data visualization and analytics
 */

export interface DateGroup {
  date: string
  memos: MemoWithResources[]
}

export interface MonthlyData {
  month: string
  memos: MemoWithResources[]
  stats: {
    totalCount: number
    wordCount: number
    resourceCount: number
    moods: Record<string, number>
  }
}

export interface HeatmapDay {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4 // Activity level for visualization
}

export interface HeatmapData {
  days: HeatmapDay[]
  maxCount: number
  totalMemos: number
  streak: number
}
