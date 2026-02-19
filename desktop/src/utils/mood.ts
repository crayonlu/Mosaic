import { MoodKey } from '@mosaic/api'

/**
 * Mood configuration with color and labels
 */
export interface MoodConfig {
  /** Unique mood identifier */
  key: MoodKey
  /** Chinese label */
  label: string
  /** Color for visual representation */
  color: string
}

/**
 * Unified mood configurations
 */
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

/** Mood label lookup by key */
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

/** Mood color lookup by key */
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

/**
 * Get label for a mood key
 * @param moodKey - The mood key (case-insensitive)
 * @returns Label string, or '未知' if not found
 */
export function getMoodLabel(moodKey?: string | null): string {
  if (!moodKey) return '未知'
  const key = moodKey.toLowerCase() as MoodKey
  return MOOD_LABEL_MAP[key] ?? moodKey
}

/**
 * Get color for a mood key
 * @param moodKey - The mood key (case-insensitive)
 * @returns Color hex string, or neutral color if not found
 */
export function getMoodColor(moodKey?: string | null): string {
  if (!moodKey) return MOOD_COLOR_MAP.neutral
  const key = moodKey.toLowerCase() as MoodKey
  return MOOD_COLOR_MAP[key] ?? MOOD_COLOR_MAP.neutral
}

export const MOOD_INTENSITY_LEVELS = 10

export const DEFAULT_MOOD: MoodKey = 'neutral'
