import { statsApi } from '@mosaic/api'
import { useQuery } from '@tanstack/react-query'

export function useStats() {
  const now = new Date()
  return useQuery({
    queryKey: ['stats', now.getFullYear(), now.getMonth() + 1],
    queryFn: () => statsApi.getSummary({ year: now.getFullYear(), month: now.getMonth() + 1 }),
  })
}
