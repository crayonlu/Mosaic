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

export function useMemoMemoryContexts(
  memoId: string,
  opts?: { enabled?: boolean; limit?: number }
) {
  return useQuery({
    queryKey: ['memo-memory-contexts', memoId, opts?.limit],
    queryFn: () => memoryApi.getMemoContexts(memoId, opts?.limit),
    staleTime: 5 * 60_000,
    enabled: (opts?.enabled ?? true) && !!memoId,
  })
}

export function useMemoryContext(
  memoId: string,
  botId: string,
  opts?: { enabled?: boolean; limit?: number }
) {
  return useQuery({
    queryKey: ['memory-context', memoId, botId, opts?.limit],
    queryFn: () => memoryApi.getContext(memoId, botId, opts?.limit),
    staleTime: 5 * 60_000,
    enabled: (opts?.enabled ?? true) && !!memoId && !!botId,
  })
}
