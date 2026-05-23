import { apiClient } from './client'
import type { MemoContextsResponse, MemoryActivityEntry, MemoryContext, MemoryStats } from './types'

export const memoryApi = {
  getStats(): Promise<MemoryStats> {
    return apiClient.get<MemoryStats>('/api/memory/stats')
  },

  getActivity(limit = 20): Promise<MemoryActivityEntry[]> {
    return apiClient.get<MemoryActivityEntry[]>(`/api/memory/activity?limit=${limit}`)
  },

  getContext(memoId: string, botId: string, limit?: number): Promise<MemoryContext> {
    const params = `memo_id=${memoId}&bot_id=${botId}${limit ? `&limit=${limit}` : ''}`
    return apiClient.get<MemoryContext>(`/api/memory/context?${params}`)
  },

  getMemoContexts(memoId: string, limit?: number): Promise<MemoContextsResponse> {
    const params = limit ? `?limit=${limit}` : ''
    return apiClient.get<MemoContextsResponse>(`/api/memos/${memoId}/memory-contexts${params}`)
  },
}
