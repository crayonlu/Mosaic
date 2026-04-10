import type { MoodKey } from '@mosaic/api'
import { QUIET_PAPER_MOOD_COLORS } from './designTokens'

export type { MoodKey }

export interface MoodConfig {
  key: MoodKey
  label: string
  color: string
}

export const MOODS: MoodConfig[] = [
  { key: 'joy', label: '愉悦', color: QUIET_PAPER_MOOD_COLORS.joy },
  { key: 'anger', label: '愤怒', color: QUIET_PAPER_MOOD_COLORS.anger },
  { key: 'sadness', label: '悲伤', color: QUIET_PAPER_MOOD_COLORS.sadness },
  { key: 'calm', label: '平静', color: QUIET_PAPER_MOOD_COLORS.calm },
  { key: 'anxiety', label: '焦虑', color: QUIET_PAPER_MOOD_COLORS.anxiety },
  { key: 'focus', label: '专注', color: QUIET_PAPER_MOOD_COLORS.focus },
  { key: 'tired', label: '疲惫', color: QUIET_PAPER_MOOD_COLORS.tired },
  { key: 'neutral', label: '无感', color: QUIET_PAPER_MOOD_COLORS.neutral },
] as const

export const MOOD_LABEL_MAP: Record<MoodKey, string> = {
  joy: '愉悦',
  anger: '愤怒',
  sadness: '悲伤',
  calm: '平静',
  anxiety: '焦虑',
  focus: '专注',
  tired: '疲惫',
  neutral: '无感',
}

export const MOOD_COLOR_MAP: Record<MoodKey, string> = {
  joy: QUIET_PAPER_MOOD_COLORS.joy,
  anger: QUIET_PAPER_MOOD_COLORS.anger,
  sadness: QUIET_PAPER_MOOD_COLORS.sadness,
  calm: QUIET_PAPER_MOOD_COLORS.calm,
  anxiety: QUIET_PAPER_MOOD_COLORS.anxiety,
  focus: QUIET_PAPER_MOOD_COLORS.focus,
  tired: QUIET_PAPER_MOOD_COLORS.tired,
  neutral: QUIET_PAPER_MOOD_COLORS.neutral,
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
  if (!moodKey) return 'rgba(154, 148, 138, 0.5)'
  const baseColor = MOOD_COLOR_MAP[moodKey] || MOOD_COLOR_MAP.neutral
  const opacity = 0.2 + (intensity !== undefined ? (intensity / 10) * 0.6 : 0.5)

  const hex = baseColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}
