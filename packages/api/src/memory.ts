import { apiClient } from './client'
import type { MemoryActivityEntry, MemoryContext, MemoryStats } from './types'

export const memoryApi = {
  getStats(): Promise<MemoryStats> {
    return apiClient.get<MemoryStats>('/api/memory/stats')
  },

  getActivity(limit = 20): Promise<MemoryActivityEntry[]> {
    return apiClient.get<MemoryActivityEntry[]>(`/api/memory/activity?limit=${limit}`)
  },

  getContext(memoId: string, botId: string): Promise<MemoryContext> {
    return apiClient.get<MemoryContext>(`/api/memory/context?memo_id=${memoId}&bot_id=${botId}`)
  },
}
