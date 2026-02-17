import { apiClient } from './client'
import type {
  CreateDiaryRequest,
  DiaryResponse,
  DiaryWithMemosResponse,
  ListDiariesQuery,
  PaginatedResponse,
  UpdateDiaryMoodRequest,
  UpdateDiaryRequest,
  UpdateDiarySummaryRequest,
} from './types'

export const diariesApi = {
  list(query?: ListDiariesQuery): Promise<PaginatedResponse<DiaryResponse>> {
    return apiClient.get<PaginatedResponse<DiaryResponse>>('/api/diaries', query)
  },

  get(date: string): Promise<DiaryWithMemosResponse> {
    return apiClient.get<DiaryWithMemosResponse>(`/api/diaries/${date}`)
  },

  create(date: string, data: Omit<CreateDiaryRequest, 'date'>): Promise<DiaryResponse> {
    return apiClient.post<DiaryResponse>(`/api/diaries/${date}`, { ...data, date })
  },

  createOrUpdate(date: string, data: Partial<CreateDiaryRequest>): Promise<DiaryResponse> {
    return apiClient.post<DiaryResponse>(`/api/diaries/${date}`, { ...data, date })
  },

  update(date: string, data: UpdateDiaryRequest): Promise<DiaryResponse> {
    return apiClient.put<DiaryResponse>(`/api/diaries/${date}`, data)
  },

  updateSummary(date: string, data: UpdateDiarySummaryRequest): Promise<DiaryResponse> {
    return apiClient.put<DiaryResponse>(`/api/diaries/${date}/summary`, data)
  },

  updateMood(date: string, data: UpdateDiaryMoodRequest): Promise<DiaryResponse> {
    return apiClient.put<DiaryResponse>(`/api/diaries/${date}/mood`, data)
  },
}
