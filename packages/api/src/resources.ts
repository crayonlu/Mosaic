import { apiClient } from './client'
import type {
  ConfirmUploadRequest,
  CreateResourceRequest,
  ListResourcesQuery,
  PaginatedResponse,
  PresignedUploadResponse,
  ResourceResponse,
  UploadFile,
  UploadResourceBatchOptions,
  UploadResourceEntry,
  UploadResourceOptions,
  UserResponse,
} from './types'

export function toAbsoluteUrl(url?: string): string {
  if (!url) return ''
  if (/^https?:/i.test(url)) return url
  const baseUrl = apiClient.getBaseUrl()
  if (!baseUrl) {
    console.warn('[resourcesApi] baseUrl is not set, URL may be invalid:', url)
    return url
  }
  return url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`
}

export const resourcesApi = {
  list(query?: ListResourcesQuery): Promise<PaginatedResponse<ResourceResponse>> {
    return apiClient.get<PaginatedResponse<ResourceResponse>>('/api/resources', query)
  },

  get(id: string): Promise<ResourceResponse> {
    return apiClient.get<ResourceResponse>(`/api/resources/${id}`)
  },

  upload(file: UploadFile, options: UploadResourceOptions = {}): Promise<ResourceResponse> {
    const additionalFields: Record<string, string> = {}

    if (options.memoId) {
      additionalFields.memoId = options.memoId
    }

    if (options.metadata) {
      additionalFields.metadata = JSON.stringify(options.metadata)
    }

    return apiClient.uploadFile<ResourceResponse>('/api/resources/upload', file, {
      additionalFields,
      onProgress: options.onProgress,
    })
  },

  presignedUpload(data: CreateResourceRequest): Promise<PresignedUploadResponse> {
    return apiClient.post<PresignedUploadResponse>('/api/resources/presigned-upload', data)
  },

  confirmUpload(data: ConfirmUploadRequest): Promise<ResourceResponse> {
    return apiClient.post<ResourceResponse>('/api/resources/confirm-upload', data)
  },

  uploadAvatar(file: UploadFile): Promise<UserResponse> {
    return apiClient.uploadFile<UserResponse>('/api/resources/upload-avatar', file)
  },

  delete(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/resources/${id}`)
  },

  getDownloadUrl(id: string, variant?: 'thumb' | 'opt'): string {
    const path = `/api/resources/${id}/download`
    const variantParam = variant ? `?variant=${variant}` : ''
    return toAbsoluteUrl(path + variantParam)
  },

  getThumbnailUrl(id: string): string {
    return toAbsoluteUrl(`/api/resources/${id}/thumbnail`)
  },
}

export async function uploadResourceFiles<TFile extends UploadFile>(
  entries: UploadResourceEntry<TFile>[],
  options: UploadResourceBatchOptions<TFile> = {}
): Promise<ResourceResponse[]> {
  const uploadedResources: ResourceResponse[] = []

  for (const entry of entries) {
    options.onFileStart?.(entry)

    try {
      const metadata = await options.resolveMetadata?.(entry.file, entry)
      const resource = await resourcesApi.upload(entry.file, {
        memoId: options.memoId,
        metadata,
        onProgress: progress => options.onFileProgress?.(entry, progress),
      })

      uploadedResources.push(resource)
      options.onFileComplete?.(entry, resource)
    } catch (error) {
      options.onFileError?.(entry, error)
      throw error
    }
  }

  return uploadedResources
}
