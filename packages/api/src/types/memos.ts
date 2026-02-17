import type { Resource } from './resources'

export interface Memo {
  id: string
  content: string
  tags: string[]
  isArchived: boolean
  diaryDate?: string
  createdAt: number
  updatedAt: number
}

export interface MemoWithResources extends Memo {
  resources: Resource[]
}

export type MemoResponse = Memo
export type MemoWithResourcesResponse = MemoWithResources

export interface ListMemosQuery {
  page?: number
  pageSize?: number
  archived?: boolean
  diaryDate?: string
  [key: string]: unknown
}

export interface CreateMemoRequest {
  content: string
  tags?: string[]
  resourceIds?: string[]
  diaryDate?: string
}

export interface UpdateMemoRequest {
  content?: string
  tags?: string[]
  resourceIds?: string[]
  isArchived?: boolean
  diaryDate?: string | null
}

export interface SearchMemosQuery {
  query: string
  tags?: string[]
  startDate?: string
  endDate?: string
  isArchived?: boolean
  page?: number
  pageSize?: number
  [key: string]: unknown
}
