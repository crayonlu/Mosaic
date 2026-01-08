import type { Resource } from './resource'

/**
 * Memo Types
 * Core data structures for memo entities
 */

export interface Memo {
  id: string
  content: string
  tags: string[]
  isArchived: boolean
  isDeleted: boolean
  diaryDate?: string // format: 'YYYY-MM-DD'
  createdAt: number // timestamp in milliseconds
  updatedAt: number // timestamp in milliseconds
}

export interface MemoWithResources extends Memo {
  resources: Resource[]
}

export interface CreateMemoRequest {
  content: string
  tags?: string[]
  resourceFilenames?: string[]
}

export interface ListMemosRequest {
  page?: number
  pageSize?: number
  isArchived?: boolean
  isDeleted?: boolean
  diaryDate?: string
}

export interface UpdateMemoRequest {
  id: string
  content?: string
  tags?: string[]
  resourceFilenames?: string[]
}

export interface SearchMemosRequest {
  query?: string
  tags?: string[]
  startDate?: string
  endDate?: string
  isArchived?: boolean
  page?: number
  pageSize?: number
}

export interface MemoRow {
  id: string
  content: string
  tags: string
  is_archived: number // 0 or 1
  is_deleted: number // 0 or 1
  diary_date: string | null
  created_at: number
  updated_at: number
}
