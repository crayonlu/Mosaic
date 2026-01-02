/**
 * Shared Types for Mosaic Mobile App
 */

// ============================================================================
// Memo Types
// ============================================================================
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

// ============================================================================
// Resource Types
// ============================================================================
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

// ============================================================================
// Input/Editor Types
// ============================================================================
export interface InputState {
  value: string
  tags: string[]
  resources: ResourcePreview[]
  isExpanded: boolean
}

export interface EditorToolbarItem {
  key: string
  icon: string
  label: string
  action: () => void
}

// ============================================================================
// Search Types
// ============================================================================
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

// ============================================================================
// View Types
// ============================================================================
export type ViewMode = 'timeline' | 'grid' | 'list'

export type SortOrder = 'asc' | 'desc' // ascending or descending by date

export interface ViewState {
  mode: ViewMode
  sortOrder: SortOrder
  showDateHeaders: boolean
}

// ============================================================================
// Settings Types
// ============================================================================
export interface AppSettings {
  theme: 'light' | 'dark' | 'auto'
  language: string
  notifications: boolean
  backupEnabled: boolean
  autoSaveDelay: number // milliseconds
  editorDefaultHeight: number
}

// ============================================================================
// Voice Recording Types
// ============================================================================
export interface VoiceRecording {
  id: string
  duration: number // seconds
  size: number // bytes
  localPath: string
  createdAt: string
}

export interface TranscriptionResult {
  text: string
  confidence: number
  timestamp: string
}

// ============================================================================
// AI Types
// ============================================================================
export interface AITagSuggestion {
  tags: string[]
  confidence: number
}

export interface AIRequest {
  content: string
  existingTags: string[]
}

export interface AIRewriteRequest {
  content: string
  tone?: 'professional' | 'casual' | 'concise' | 'detailed' | 'friendly'
}

// ============================================================================
// Notification Types
// ============================================================================
export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message?: string
  duration?: number
}

// ============================================================================
// Date Types
// ============================================================================
export interface DateGroup {
  date: string
  memos: MemoWithResources[]
}

export interface MonthlyData {
  month: string
  memos: MemoWithResources[]
  stats: {
    totalCount: number
    wordCount: number
    resourceCount: number
    moods: Record<string, number>
  }
}

// ============================================================================
// Heatmap Types
// ============================================================================
export interface HeatmapDay {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4 // Activity level for visualization
}

export interface HeatmapData {
  days: HeatmapDay[]
  maxCount: number
  totalMemos: number
  streak: number
}

// ============================================================================
// Animation Types
// ============================================================================
export type AnimationType = 'spring' | 'timing' | 'decay'

export interface AnimationConfig {
  type: AnimationType
  duration?: number
  delay?: number
  dampingRatio?: number
  stiffness?: number
}

// ============================================================================
// Tab Bar Types
// ============================================================================
export interface TabItem {
  name: string
  key: string
  screen: string
  icon: {
    focused: string
    unfocused: string
  }
  label: string
  badge?: number
}

// ============================================================================
// Navigation Types (re-export from navigation/types)
// ============================================================================
export type { RootParamList, TabParamList, ModalParamList } from '@/navigation/types'
