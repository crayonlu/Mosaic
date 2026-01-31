export type ResourceType = 'image' | 'audio' | 'video' | 'file'

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
