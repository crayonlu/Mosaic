/**
 * Shared Types for Mosaic Mobile App
 *
 * This file re-exports all types from their respective modules for easy importing.
 *
 * Usage:
 *   import { Memo, CreateMemoRequest } from '@/types'
 *   import type { Memo, Resource } from '@/types'
 */

// ============================================================================
// Memo Types
// ============================================================================
export type {
  CreateMemoRequest,
  ListMemosRequest,
  Memo,
  MemoRow,
  MemoWithResources,
  SearchMemosRequest,
  UpdateMemoRequest,
} from './memo'

// ============================================================================
// Resource Types
// ============================================================================
export { ResourceType } from './resource'
export type { Resource, ResourcePreview } from './resource'

// ============================================================================
// Diary Types
// ============================================================================
export { MoodKey } from './diary'
export type { Diary, DiaryWithMemos } from './diary'

// ============================================================================
// User Types
// ============================================================================
export type { UpdateUserRequest, User } from './user'

// ============================================================================
// Settings Types
// ============================================================================
export { SettingCategory, SettingKey } from './settings'
export type { AppSettings, Setting } from './settings'

// ============================================================================
// Common Types
// ============================================================================
export type { PaginatedResponse } from './common'

// ============================================================================
// Stats Types
// ============================================================================
export type { DashboardData, MoodTrend } from './stats'

// ============================================================================
// Input/Editor Types
// ============================================================================
export type { EditorToolbarItem, InputState } from './editor'

// ============================================================================
// Search Types
// ============================================================================
export type { SearchFilters, SearchResult } from './search'

// ============================================================================
// View Types
// ============================================================================
export type { SortOrder, ViewMode, ViewState } from './view'

// ============================================================================
// Voice Recording Types
// ============================================================================
export type { TranscriptionResult, VoiceRecording } from './voice'

// ============================================================================
// AI Types
// ============================================================================
export type { AIRequest, AIRewriteRequest, AITagSuggestion } from './ai'

// ============================================================================
// Notification Types
// ============================================================================
export type { Notification, NotificationType } from './notification'

// ============================================================================
// Chart Types
// ============================================================================
export type { DateGroup, HeatmapData, HeatmapDay, MonthlyData } from './chart'

// ============================================================================
// Navigation Types
// ============================================================================
export type { RootParamList, TabParamList } from './navigation'

// ============================================================================
// UI Component Types
// ============================================================================
export type { AnimationConfig, AnimationType, TabItem } from './ui'
