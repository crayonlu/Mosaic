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
  memoCount: number
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
  | 'happy'
  | 'sad'
  | 'angry'
  | 'anxious'
  | 'calm'
  | 'excited'
  | 'tired'
  | 'neutral'

export const moodLabels: Record<MoodKey, string> = {
  happy: '愉悦',
  sad: '悲伤',
  angry: '愤怒',
  calm: '平静',
  anxious: '焦虑',
  excited: '兴奋',
  tired: '疲惫',
  neutral: '中性',
}

export const moodColors: Record<MoodKey, string> = {
  happy: '#FFD93D',
  excited: '#FF6B6B',
  calm: '#6BCB77',
  neutral: '#95A5A6',
  tired: '#9B59B6',
  anxious: '#E67E22',
  sad: '#3498DB',
  angry: '#E74C3C',
}
