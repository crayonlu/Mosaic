export const MOOD_KEYS = [
  'joy',
  'anger',
  'sadness',
  'calm',
  'anxiety',
  'focus',
  'tired',
  'neutral',
] as const

export type MoodKey = (typeof MOOD_KEYS)[number]

export interface MoodConfig {
  key: MoodKey
  label: string
  color: string
}

export const MOODS: MoodConfig[] = [
  { key: 'joy', label: '愉悦', color: '#FFD93D' },
  { key: 'anger', label: '愤怒', color: '#FF6B6B' },
  { key: 'sadness', label: '悲伤', color: '#4ECDC4' },
  { key: 'calm', label: '平静', color: '#95E1D3' },
  { key: 'anxiety', label: '焦虑', color: '#FFA07A' },
  { key: 'focus', label: '专注', color: '#6C5CE7' },
  { key: 'tired', label: '疲惫', color: '#A8A8A8' },
  { key: 'neutral', label: '中性', color: '#B8B8B8' },
] as const

export const MOOD_LABEL_MAP: Record<MoodKey, string> = {
  joy: '愉悦',
  anger: '愤怒',
  sadness: '悲伤',
  calm: '平静',
  anxiety: '焦虑',
  focus: '专注',
  tired: '疲惫',
  neutral: '中性',
}

export const MOOD_COLOR_MAP: Record<MoodKey, string> = {
  joy: '#FFD93D',
  anger: '#FF6B6B',
  sadness: '#4ECDC4',
  calm: '#95E1D3',
  anxiety: '#FFA07A',
  focus: '#6C5CE7',
  tired: '#A8A8A8',
  neutral: '#B8B8B8',
}
