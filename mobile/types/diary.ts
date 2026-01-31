import type { MemoWithResources } from './memo'

export enum MoodKey {
  Joy = 'joy',
  Anger = 'anger',
  Sadness = 'sadness',
  Calm = 'calm',
  Anxiety = 'anxiety',
  Focus = 'focus',
  Tired = 'tired',
  Neutral = 'neutral',
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

export interface DiaryWithMemos extends Diary {
  memos: MemoWithResources[]
}
