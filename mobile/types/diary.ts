import type { MoodKey } from '@mosaic/api'
import type { MemoWithResources } from './memo'

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
