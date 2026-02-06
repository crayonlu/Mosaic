import type {
  ConfirmUploadRequest,
  CreateResourceRequest,
  ListResourcesQuery,
  PaginatedResponse,
  PresignedUploadResponse,
  PresignedUrlResponse,
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

  getPresignedUrl(id: string): Promise<PresignedUrlResponse> {
    return apiClient.get<PresignedUrlResponse>(`/api/resources/${id}`)
  },

  async getDownloadUrl(id: string, baseUrl?: string): Promise<string> {
    const response = await this.getPresignedUrl(id)
    const cleanBaseUrl = (baseUrl || apiClient.getBaseUrl())?.replace(/\/$/, '') || ''
    return `${cleanBaseUrl}${response.url}`
  },
}
