import type { MoodKey } from '@mosaic/api'

export type * from '@mosaic/api'

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
