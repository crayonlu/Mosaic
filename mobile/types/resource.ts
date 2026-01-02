/**
 * Resource Types
 * File and attachment management types
 */

export type ResourceType = 'image' | 'video' | 'audio' | 'file' | 'link'

export interface Resource {
  id: string
  memoId: string
  filename: string
  type: ResourceType
  size?: number
  url?: string
  localPath?: string
  createdAt: string
}

export interface ResourcePreview {
  filename: string
  previewUrl: string
  type: ResourceType
  size: number
}
