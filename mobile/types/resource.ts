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

export interface ResourcePreview {
  filename: string
  previewUrl: string
  type: ResourceType
  size?: number
}

export interface ServerResourceResponse {
  id: string
  memoId: string
  filename: string
  resourceType: string
  mimeType: string
  fileSize: number
  storageType: string
  url: string
  createdAt: number
}

export interface ServerCreateResourceRequest {
  memoId: string
  filename: string
  mimeType: string
  fileSize: number
}

export interface ServerPresignedUploadResponse {
  uploadUrl: string
  resourceId: string
  storagePath: string
}

export interface ServerConfirmUploadRequest {
  resourceId: string
}

export interface ServerPresignedUrlResponse {
  url: string
}
