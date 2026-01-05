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
