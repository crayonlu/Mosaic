import type { Diary, DiaryWithMemos } from './diary'
import type { Memo, MemoWithResources } from './memo'
import type { Resource } from './resource'
import type { User } from './user'

export interface ApiError {
  error: string
  status?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface ServerConfig {
  url: string
  username: string
  password: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse extends AuthTokens {
  user: User
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export type RefreshTokenResponse = AuthTokens

export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
}

export interface UpdateUserRequest {
  username?: string
  avatarUrl?: string
}

export interface UpdateAvatarRequest {
  avatarUrl: string
}

export interface ListMemosQuery {
  page?: number
  pageSize?: number
  archived?: boolean
  diaryDate?: string
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
  resourceFilenames?: string[]
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
}

export interface ListDiariesQuery {
  page?: number
  pageSize?: number
  startDate?: string
  endDate?: string
}

export interface CreateDiaryRequest {
  date: string
  summary: string
  moodKey: string
  moodScore?: number
  coverImageId?: string
}

export interface UpdateDiaryRequest {
  summary?: string
  moodKey?: string
  moodScore?: number
  coverImageId?: string | null
}

export interface UpdateDiarySummaryRequest {
  summary: string
}

export interface UpdateDiaryMoodRequest {
  moodKey: string
  moodScore: number
}

export interface ListResourcesQuery {
  page?: number
  pageSize?: number
}

export interface CreateResourceRequest {
  memoId: string
  filename: string
  mimeType: string
  fileSize: number
}

export interface PresignedUploadResponse {
  uploadUrl: string
  resourceId: string
  storagePath: string
}

export interface ConfirmUploadRequest {
  resourceId: string
}

export interface StatsQuery {
  start_date: string
  end_date: string
}

export interface SummaryQuery {
  year: number
  month: number
}

export interface HeatMapData {
  dates: string[]
  counts: number[]
  moods: (string | null)[]
  moodScores: (number | null)[]
}

export interface TimelineEntry {
  date: string
  moodKey: string | null
  moodScore: number | null
  summary: string
  memoCount: number
  color: string
}

export interface TimelineData {
  entries: TimelineEntry[]
}

export interface MoodData {
  moodKey: string
  count: number
  percentage: number
}

export interface TagData {
  tag: string
  count: number
}

export interface TrendsData {
  moods: MoodData[]
  tags: TagData[]
}

export interface SummaryData {
  totalMemos: number
  totalDiaries: number
  totalResources: number
}

export interface HealthResponse {
  status: string
  version: string
}

export type UserResponse = User
export type MemoResponse = Memo
export type MemoWithResourcesResponse = MemoWithResources
export type DiaryResponse = Diary
export type DiaryWithMemosResponse = DiaryWithMemos
export type ResourceResponse = Resource
