/**
 * View Types
 * Display modes and view state management
 */

export type ViewMode = 'timeline' | 'grid' | 'list'

export type SortOrder = 'asc' | 'desc' // ascending or descending by date

export interface ViewState {
  mode: ViewMode
  sortOrder: SortOrder
  showDateHeaders: boolean
}
