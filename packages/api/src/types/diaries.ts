import type { MemoWithResources } from './memos'

export type MoodKey =
  | 'happy'
  | 'calm'
  | 'neutral'
  | 'sad'
  | 'anxious'
  | 'angry'
  | 'excited'
  | 'tired'

export interface Diary {
  date: string
  summary: string
  moodKey: MoodKey
  moodScore: number
  coverImageId?: string
  createdAt: number
  updatedAt: number
}

export interface DiaryWithMemos extends Diary {
  memos: MemoWithResources[]
}

export type DiaryResponse = Diary
export type DiaryWithMemosResponse = DiaryWithMemos

export interface ListDiariesQuery {
  page?: number
  pageSize?: number
  startDate?: string
  endDate?: string
  [key: string]: unknown
}

export interface CreateDiaryRequest {
  date: string
  summary: string
  moodKey: MoodKey
  moodScore?: number
  coverImageId?: string
}

export interface UpdateDiaryRequest {
  summary?: string
  moodKey?: MoodKey
  moodScore?: number
  coverImageId?: string | null
}

export interface UpdateDiarySummaryRequest {
  summary: string
}

export interface UpdateDiaryMoodRequest {
  moodKey: MoodKey
  moodScore: number
}
