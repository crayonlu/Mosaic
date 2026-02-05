export interface HeatMapCell {
  date: string
  color: string
  count: number
  moodKey?: string
  moodScore?: number
  isToday?: boolean
}

export interface HeatMapData {
  startDate: string
  endDate: string
  cells: HeatMapCell[]
}
