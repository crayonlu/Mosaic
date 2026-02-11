import { tokenStorage } from '@/lib/services/token-storage'
import type {
  ConfirmUploadRequest,
  CreateResourceRequest,
  ListResourcesQuery,
  PaginatedResponse,
  PresignedUploadResponse,
  ResourceResponse,
  UserResponse,
} from '@/types/api'
import { apiClient } from './client'

export const resourcesApi = {
  list(query?: ListResourcesQuery): Promise<PaginatedResponse<ResourceResponse>> {
    return apiClient.get<PaginatedResponse<ResourceResponse>>('/api/resources', query as any)
  },

  get(id: string): Promise<ResourceResponse> {
    return apiClient.get<ResourceResponse>(`/api/resources/${id}`)
  },

  upload(
    file: { uri: string; name: string; type: string },
    memoId: string
  ): Promise<ResourceResponse> {
    return apiClient.uploadFile<ResourceResponse>('/api/resources/upload', file, { memoId })
  },

  presignedUpload(data: CreateResourceRequest): Promise<PresignedUploadResponse> {
    return apiClient.post<PresignedUploadResponse>('/api/resources/presigned-upload', data)
  },

  confirmUpload(data: ConfirmUploadRequest): Promise<ResourceResponse> {
    return apiClient.post<ResourceResponse>('/api/resources/confirm-upload', data)
  },

  uploadAvatar(file: { uri: string; name: string; type: string }): Promise<UserResponse> {
    return apiClient.uploadFile<UserResponse>('/api/resources/upload-avatar', file)
  },

  delete(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/resources/${id}`)
  },

  /**
   * Get resource download URL for Bearer token authentication
   * Use with expo-image's source.uri prop
   */
  getDirectDownloadUrl(id: string): string {
    const baseUrl = apiClient.getBaseUrl()
    return `${baseUrl}/api/resources/${id}/download`
  },

  /**
   * Get auth headers for image requests (without Content-Type)
   * Use with expo-image's source.headers prop
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await tokenStorage.getAccessToken()
    if (!token) {
      return {}
    }
    return {
      Authorization: `Bearer ${token}`,
    }
  },
}
