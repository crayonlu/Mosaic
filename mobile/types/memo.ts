import type { Resource } from './resource'

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
