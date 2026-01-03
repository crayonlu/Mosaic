import { Memo } from './memo'

export interface DashboardData {
  todayMemoCount: number
  totalMemoCount: number
  recentMemos: Memo[]
  moodTrend: MoodTrend[]
}

export interface MoodTrend {
  date: string
  moodScore: number
  memoCount: number
}
