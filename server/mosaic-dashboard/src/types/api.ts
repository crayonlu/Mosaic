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

export interface Memo {
  id: string
  content: string
  tags: string[]
  isArchived: boolean
  diaryDate?: string
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
