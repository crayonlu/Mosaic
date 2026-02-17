export type ResourceType = 'image' | 'video'

export interface Resource {
  id: string
  memoId: string
  filename: string
  resourceType: ResourceType
  mimeType: string
  fileSize: number
  storageType: string
  url: string
  createdAt: number
}

export type ResourceResponse = Resource

export interface ResourcePreview {
  filename: string
  previewUrl: string
  type: ResourceType
  size?: number
}

export interface ListResourcesQuery {
  page?: number
  pageSize?: number
  [key: string]: unknown
}

export interface CreateResourceRequest {
  memoId: string
  filename: string
  mimeType: string
  fileSize: number
}

export interface PresignedUploadResponse {
  uploadUrl: string
  resourceId: string
  storagePath: string
}

export interface ConfirmUploadRequest {
  resourceId: string
}

export interface PresignedUrlResponse {
  url: string
}
