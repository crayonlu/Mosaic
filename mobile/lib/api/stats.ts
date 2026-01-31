import type {
  HeatMapData,
  StatsQuery,
  SummaryData,
  SummaryQuery,
  TimelineData,
  TrendsData,
} from '@/types/api'
import { apiClient } from './client'

export const statsApi = {
  getHeatmap(query: StatsQuery): Promise<HeatMapData> {
    return apiClient.get<HeatMapData>('/api/stats/heatmap', query as any)
  },

  getTimeline(query: StatsQuery): Promise<TimelineData> {
    return apiClient.get<TimelineData>('/api/stats/timeline', query as any)
  },

  getTrends(query: StatsQuery): Promise<TrendsData> {
    return apiClient.get<TrendsData>('/api/stats/trends', query as any)
  },

  getSummary(query: SummaryQuery): Promise<SummaryData> {
    return apiClient.get<SummaryData>('/api/stats/summary', query as any)
  },
}
