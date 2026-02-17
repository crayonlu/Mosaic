import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../stats'
import type { StatsQuery, SummaryQuery } from '../types'

const DEFAULT_STALE_TIME = 5 * 60 * 1000

export function useHeatmap(query: StatsQuery) {
  return useQuery({
    queryKey: ['stats', 'heatmap', query],
    queryFn: () => statsApi.getHeatmap(query),
    staleTime: DEFAULT_STALE_TIME,
  })
}

export function useTimeline(query: StatsQuery) {
  return useQuery({
    queryKey: ['stats', 'timeline', query],
    queryFn: () => statsApi.getTimeline(query),
    staleTime: DEFAULT_STALE_TIME,
  })
}

export function useTrends(query: StatsQuery) {
  return useQuery({
    queryKey: ['stats', 'trends', query],
    queryFn: () => statsApi.getTrends(query),
    staleTime: DEFAULT_STALE_TIME,
  })
}

export function useStatsSummary(query: SummaryQuery) {
  return useQuery({
    queryKey: ['stats', 'summary', query],
    queryFn: () => statsApi.getSummary(query),
    staleTime: DEFAULT_STALE_TIME,
  })
}
