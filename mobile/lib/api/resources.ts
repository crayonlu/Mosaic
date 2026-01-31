import type {
  ConfirmUploadRequest,
  CreateResourceRequest,
  ListResourcesQuery,
  PaginatedResponse,
  PresignedUploadResponse,
  ResourceResponse,
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

  uploadAvatar(file: { uri: string; name: string; type: string }): Promise<ResourceResponse> {
    return apiClient.uploadFile<ResourceResponse>('/api/resources/upload-avatar', file)
  },

  delete(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/resources/${id}`)
  },

  getDownloadUrl(id: string): string {
    return `${apiClient.getBaseUrl()}/api/resources/${id}/download`
  },

  getAvatarUrl(filename: string): string {
    return `${apiClient.getBaseUrl()}/api/resources/avatars/${filename}`
  },
}
