import type { Resource } from './resource'

/**
 * Memo Types
 * Core data structures for memo entities
 */

export interface Memo {
  id: string
  content: string
  tags: string[]
  mood?: string
  createdAt: string // ISO datetime string
  updatedAt: string // ISO datetime string
  isArchived?: boolean
  isFavorite?: boolean
}

export interface MemoWithResources extends Memo {
  resources: Resource[]
}

export interface CreateMemoInput {
  content: string
  tags?: string[]
  mood?: string
  resourceFilenames?: string[]
}

export interface UpdateMemoInput {
  id: string
  content?: string
  tags?: string[]
  mood?: string
  isArchived?: boolean
  isFavorite?: boolean
}
