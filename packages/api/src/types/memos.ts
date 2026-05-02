import type { Resource } from './resources'

export interface Memo {
  id: string
  content: string
  tags: string[]
  isArchived: boolean
  diaryDate?: string
  aiSummary?: string
  resources?: Resource[]
  createdAt: number
  updatedAt: number
  semanticScore?: number
  keywordScore?: number
  matchType?: 'keyword' | 'semantic' | 'hybrid'
}

export interface MemoWithResources extends Memo {
  resources: Resource[]
}

export interface TagResponse {
  tag: string
  count: number
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
  aiSummary?: string
}

export interface UpdateMemoRequest {
  content?: string
  tags?: string[]
  resourceIds?: string[]
  isArchived?: boolean
  diaryDate?: string | null
  aiSummary?: string
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

export interface SearchMemosResponse {
  memos: Memo[]
  total: number
  page: number
  pageSize: number
  semanticEnabled: boolean
}

export interface ClipRequest {
  clipType: 'url' | 'text' | 'image'
  url?: string
  content?: string
  resourceId?: string
  userNote?: string
}

export interface ClipResult {
  title: string
  content: string
  aiSummary: string
  tags: string[]
  sourceUrl: string | null
  sourceType: string
  originalTitle: string | null
}
