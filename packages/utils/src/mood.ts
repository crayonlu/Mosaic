import type { MoodKey } from '@mosaic/api'

export type { MoodKey }

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

function isValidMoodKey(value: string | null | undefined): value is MoodKey {
  if (!value) return false
  return (MOODS as readonly MoodConfig[]).some(m => m.key === value.toLowerCase())
}

function toMoodKey(moodKey?: string | null): MoodKey | undefined {
  if (!moodKey) return undefined
  const normalized = moodKey.toLowerCase()
  if (isValidMoodKey(normalized)) {
    return normalized
  }
  return undefined
}

export function getMoodLabel(moodKey?: string | null): string {
  const key = toMoodKey(moodKey)
  if (!key) return moodKey || '未知'
  return MOOD_LABEL_MAP[key] ?? moodKey
}

export function getMoodColor(moodKey?: string | null): string {
  const key = toMoodKey(moodKey)
  if (!key) return MOOD_COLOR_MAP.neutral
  return MOOD_COLOR_MAP[key] ?? MOOD_COLOR_MAP.neutral
}

export function getMoodConfig(moodKey?: string | null): MoodConfig | undefined {
  const key = toMoodKey(moodKey)
  if (!key) return undefined
  return MOODS.find(m => m.key === key)
}

export function normalizeMoodKey(moodKey?: string | null): MoodKey | undefined {
  return toMoodKey(moodKey)
}

export const MOOD_INTENSITY_LEVELS = 10

export const DEFAULT_MOOD: MoodKey = 'neutral'

export function getMoodColorWithIntensity(moodKey?: MoodKey, intensity?: number): string {
  if (!moodKey) return 'rgba(184, 184, 184, 0.5)'
  const baseColor = MOOD_COLOR_MAP[moodKey] || MOOD_COLOR_MAP.neutral
  const opacity = 0.2 + (intensity !== undefined ? (intensity / 10) * 0.6 : 0.5)

  const hex = baseColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}
