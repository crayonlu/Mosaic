import type {
  CreateMemoRequest,
  ListMemosQuery,
  MemoWithResourcesResponse,
  PaginatedResponse,
  SearchMemosQuery,
  UpdateMemoRequest,
} from '@/types/api'
import { apiClient } from './client'

export const memosApi = {
  list(query?: ListMemosQuery): Promise<PaginatedResponse<MemoWithResourcesResponse>> {
    return apiClient.get<PaginatedResponse<MemoWithResourcesResponse>>('/api/memos', query as any)
  },

  get(id: string): Promise<MemoWithResourcesResponse> {
    return apiClient.get<MemoWithResourcesResponse>(`/api/memos/${id}`)
  },

  getByDate(date: string): Promise<MemoWithResourcesResponse[]> {
    return apiClient.get<MemoWithResourcesResponse[]>(`/api/memos/date/${date}`)
  },

  create(data: CreateMemoRequest): Promise<MemoWithResourcesResponse> {
    return apiClient.post<MemoWithResourcesResponse>('/api/memos', data)
  },

  update(id: string, data: UpdateMemoRequest): Promise<MemoWithResourcesResponse> {
    return apiClient.put<MemoWithResourcesResponse>(`/api/memos/${id}`, data)
  },

  delete(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/memos/${id}`)
  },

  archive(id: string): Promise<void> {
    return apiClient.put<void>(`/api/memos/${id}/archive`)
  },

  unarchive(id: string): Promise<void> {
    return apiClient.put<void>(`/api/memos/${id}/unarchive`)
  },

  search(query: SearchMemosQuery): Promise<PaginatedResponse<MemoWithResourcesResponse>> {
    return apiClient.get<PaginatedResponse<MemoWithResourcesResponse>>(
      '/api/memos/search',
      query as any
    )
  },
}
