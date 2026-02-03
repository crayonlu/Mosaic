import type { MemoWithResources } from './memo'
import type { MoodKey } from '@/utils/mood'

export interface Diary {
  date: string
  summary: string
  moodKey: MoodKey
  moodScore: number
  coverImageId?: string
  createdAt: number
  updatedAt: number
}

export interface DiaryWithMemos {
  date: string
  summary: string
  moodKey: MoodKey
  moodScore: number
  coverImageId?: string
  createdAt: number
  updatedAt: number
  memos: MemoWithResources[]
}

export interface CreateOrUpdateDiaryRequest {
  date: string
  summary?: string
  moodKey?: MoodKey
  moodScore?: number
  coverImageId?: string
}

export interface UpdateDiarySummaryRequest {
  date: string
  summary: string
}

export interface UpdateDiaryMoodRequest {
  date: string
  moodKey: MoodKey
  moodScore: number
}

export interface ListDiariesRequest {
  page?: number
  pageSize?: number
  startDate?: string
  endDate?: string
}
