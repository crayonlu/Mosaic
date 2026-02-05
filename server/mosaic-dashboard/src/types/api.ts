export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: User
}

export interface User {
  id: string
  username: string
  avatarUrl?: string
  createdAt: number
  updatedAt: number
}

export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
}

export interface Resource {
  id: string
  memoId: string
  filename: string
  resourceType: string
  mimeType: string
  fileSize: number
  storageType: string
  url: string
  createdAt: number
}

export interface Memo {
  id: string
  content: string
  tags: string[]
  isArchived: boolean
  diaryDate?: string
  resources?: Resource[]
  createdAt: number
  updatedAt: number
}

export interface CreateMemoRequest {
  content: string
  tags?: string[]
  diaryDate?: string
}

export interface UpdateMemoRequest {
  content?: string
  tags?: string[]
  isArchived?: boolean
  diaryDate?: string | null
}

export interface Diary {
  date: string
  summary: string
  moodKey: string
  moodScore: number
  coverImageId?: string
  createdAt: number
  updatedAt: number
}

export interface CreateDiaryRequest {
  date: string
  summary: string
  moodKey: string
  moodScore?: number
  coverImageId?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export type MoodKey =
  | 'joy'
  | 'anger'
  | 'sadness'
  | 'calm'
  | 'anxiety'
  | 'focus'
  | 'tired'
  | 'neutral'

export const moodLabels: Record<MoodKey, string> = {
  joy: '愉悦',
  anger: '愤怒',
  sadness: '悲伤',
  calm: '平静',
  anxiety: '焦虑',
  focus: '专注',
  tired: '疲惫',
  neutral: '中性',
}

export const moodColors: Record<MoodKey, string> = {
  joy: '#FFD93D',
  anger: '#FF6B6B',
  sadness: '#4ECDC4',
  calm: '#95E1D3',
  anxiety: '#FFA07A',
  focus: '#6C5CE7',
  tired: '#A8A8A8',
  neutral: '#B8B8B8',
}
