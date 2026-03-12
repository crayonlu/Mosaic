import type { UploadFile, UploadProgress } from './client'

export type ResourceType = 'image' | 'video'

export interface ResourceMetadata {
  width?: number
  height?: number
  durationMs?: number
  thumbnailTimeMs?: number
}

export interface Resource {
  id: string
  memoId: string | null
  filename: string
  resourceType: ResourceType
  mimeType: string
  fileSize: number
  storageType: string
  url: string
  thumbnailUrl?: string
  metadata: ResourceMetadata
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
  memoId?: string
  filename: string
  mimeType: string
  fileSize: number
  metadata?: ResourceMetadata
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

export interface UploadResourceOptions {
  memoId?: string
  metadata?: ResourceMetadata
  onProgress?: (progress: UploadProgress) => void
}

export interface UploadResourceEntry<TFile extends UploadFile = UploadFile> {
  id: string
  file: TFile
}

export interface UploadResourceBatchOptions<TFile extends UploadFile = UploadFile> {
  memoId?: string
  resolveMetadata?: (
    file: TFile,
    entry: UploadResourceEntry<TFile>
  ) => Promise<ResourceMetadata | undefined> | ResourceMetadata | undefined
  onFileStart?: (entry: UploadResourceEntry<TFile>) => void
  onFileProgress?: (entry: UploadResourceEntry<TFile>, progress: UploadProgress) => void
  onFileComplete?: (entry: UploadResourceEntry<TFile>, resource: ResourceResponse) => void
  onFileError?: (entry: UploadResourceEntry<TFile>, error: unknown) => void
}
