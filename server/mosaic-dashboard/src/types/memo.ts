import type {
  CreateMemoRequest,
  Memo,
  MemoWithResources,
  SearchMemosQuery,
  UpdateMemoRequest,
} from '@mosaic/api'

export type { CreateMemoRequest, Memo, MemoWithResources, UpdateMemoRequest }

export interface ListMemosRequest {
  page?: number
  pageSize?: number
  isArchived?: boolean
  isDeleted?: boolean
  diaryDate?: string
}

export type SearchMemosRequest = Partial<SearchMemosQuery>
