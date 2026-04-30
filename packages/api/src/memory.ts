import { apiClient } from './client'
import type { MemoryActivityEntry, MemoryStats } from './types'

export const memoryApi = {
  getStats(): Promise<MemoryStats> {
    return apiClient.get<MemoryStats>('/api/memory/stats')
  },

  getActivity(limit = 20): Promise<MemoryActivityEntry[]> {
    return apiClient.get<MemoryActivityEntry[]>(`/api/memory/activity?limit=${limit}`)
  },
}
