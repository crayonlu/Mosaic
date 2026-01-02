import type { MemoWithResources } from './memo'

/**
 * Search Types
 * Filtering and search functionality
 */

export interface SearchFilters {
  query: string
  dateRange?: {
    start: string
    end: string
  }
  tags?: string[]
  mood?: string
  hasResources?: boolean
}

export interface SearchResult {
  memos: MemoWithResources[]
  total: number
}
