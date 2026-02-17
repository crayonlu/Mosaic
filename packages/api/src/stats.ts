import { apiClient } from './client'
import type {
  HeatMapData,
  StatsQuery,
  SummaryData,
  SummaryQuery,
  TimelineData,
  TrendsData,
} from './types'

export const statsApi = {
  getHeatmap(query: StatsQuery): Promise<HeatMapData> {
    return apiClient.get<HeatMapData>('/api/stats/heatmap', query)
  },

  getTimeline(query: StatsQuery): Promise<TimelineData> {
    return apiClient.get<TimelineData>('/api/stats/timeline', query)
  },

  getTrends(query: StatsQuery): Promise<TrendsData> {
    return apiClient.get<TrendsData>('/api/stats/trends', query)
  },

  getSummary(query: SummaryQuery): Promise<SummaryData> {
    return apiClient.get<SummaryData>('/api/stats/summary', query)
  },
}
