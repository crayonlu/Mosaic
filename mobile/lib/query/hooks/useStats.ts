import { statsApi } from '@mosaic/api'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useMemo } from 'react'

export function useStats() {
  const year = useMemo(() => new Date().getFullYear(), [])
  const month = useMemo(() => new Date().getMonth() + 1, [])
  return useQuery({
    queryKey: ['stats', year, month],
    queryFn: () => statsApi.getSummary({ year, month }),
    staleTime: 5 * 60 * 1000,
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
