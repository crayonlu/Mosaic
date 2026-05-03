import { statsApi } from '@mosaic/api'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'

export function useStats() {
  const now = new Date()
  return useQuery({
    queryKey: ['stats', now.getFullYear(), now.getMonth() + 1],
    queryFn: () => statsApi.getSummary({ year: now.getFullYear(), month: now.getMonth() + 1 }),
  })
}

export function useHeatmap() {
  const endDate = dayjs().format('YYYY-MM-DD')
  const startDate = dayjs().subtract(6, 'month').format('YYYY-MM-DD')

  return useQuery({
    queryKey: ['stats', 'heatmap', startDate, endDate],
    queryFn: () => statsApi.getHeatmap({ startDate, endDate }),
    staleTime: 5 * 60 * 1000,
  })
}
