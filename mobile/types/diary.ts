/**
 * Diary Types
 * Daily journal entries with mood tracking
 */

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
  date: string // format: 'YYYY-MM-DD'
  summary: string
  moodKey: MoodKey
  moodScore: number // 0-100
  coverImageId?: string
  memoCount: number
  createdAt: number // timestamp in milliseconds
  updatedAt: number // timestamp in milliseconds
}

export interface DiaryWithMemos extends Diary {
  memos: MemoWithResources[]
}
