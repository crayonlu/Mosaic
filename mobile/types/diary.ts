import type { MemoWithResources } from './memo'
import type { MoodKey } from '@/lib/utils/mood'

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
