/**
 * Resource Types
 * File and attachment management types
 */

export type ResourceType = 'image' | 'audio' | 'video' | 'file'

export interface Resource {
  id: string
  memoId: string
  filename: string
  resourceType: ResourceType
  mimeType: string
  size: number
  createdAt: number // timestamp in milliseconds
}

export interface ResourcePreview {
  filename: string
  previewUrl: string
  type: ResourceType
  size?: number
}
