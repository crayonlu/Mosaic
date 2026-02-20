export interface HeatMapCell {
  date: string
  count: number
  color: string
  isToday: boolean
  moodKey?: string
  moodScore?: number
}

export interface HeatMapDataExtended {
  dates: string[]
  counts: number[]
  moods?: (string | null)[]
  moodScores?: (number | null)[]
  cells?: HeatMapCell[]
  startDate?: string
  endDate?: string
}
