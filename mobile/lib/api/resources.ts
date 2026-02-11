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
    console.log('[ResourcesAPI] getPresignedUrl', { id })
    return apiClient.get<PresignedUrlResponse>(`/api/resources/${id}`)
  },

  async getDownloadUrl(id: string, baseUrl?: string): Promise<string> {
    console.log('[ResourcesAPI] getDownloadUrl', { id, baseUrl })
    const response = await this.getPresignedUrl(id)
    console.log('[ResourcesAPI] getDownloadUrl response', { response })
    const cleanBaseUrl = (baseUrl || apiClient.getBaseUrl())?.replace(/\/$/, '') || ''
    const url = `${cleanBaseUrl}${response.url}`
    console.log('[ResourcesAPI] getDownloadUrl final url', { url })
    return url
  },
}
