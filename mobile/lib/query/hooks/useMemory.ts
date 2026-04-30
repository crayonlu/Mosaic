import { memoryApi } from '@mosaic/api'
import { useQuery } from '@tanstack/react-query'

export function useMemoryStats() {
  return useQuery({
    queryKey: ['memory-stats'],
    queryFn: () => memoryApi.getStats(),
    staleTime: 30_000,
  })
}

export function useMemoryActivity(limit = 20) {
  return useQuery({
    queryKey: ['memory-activity', limit],
    queryFn: () => memoryApi.getActivity(limit),
    staleTime: 30_000,
  })
}
