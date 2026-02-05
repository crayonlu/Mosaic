import type { Resource } from '@/types/api'

export interface Memo {
  id: string
  content: string
  tags: string[]
  isArchived: boolean
  diaryDate?: string
  createdAt: number
  updatedAt: number
}

export interface MemoWithResources {
  id: string
  content: string
  tags: string[]
  isArchived: boolean
  diaryDate?: string
  createdAt: number
  updatedAt: number
  resources: Resource[]
}

export interface CreateMemoRequest {
  content: string
  tags?: string[]
  diaryDate?: string
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
  isArchived?: boolean
  diaryDate?: string
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
