import type { MoodKey } from '@/types/diary'

export const MOOD_EMOJIS: Record<string, string> = {
  joy: '😊',
  anger: '😠',
  sadness: '😢',
  calm: '😌',
  anxiety: '😰',
  focus: '🎯',
  tired: '😴',
  neutral: '😐',
}

export const MOOD_LABELS: Record<string, string> = {
  joy: '愉悦',
  anger: '愤怒',
  sadness: '悲伤',
  calm: '平静',
  anxiety: '焦虑',
  focus: '专注',
  tired: '疲惫',
  neutral: '中性',
}

export function getMoodEmoji(moodKey?: MoodKey | string): string {
  if (!moodKey) return '😐'
  return MOOD_EMOJIS[moodKey] || '😐'
}

export function getMoodLabel(moodKey?: MoodKey | string): string {
  if (!moodKey) return '未知'
  return MOOD_LABELS[moodKey] || moodKey
}

export const MOOD_OPTIONS = [
  { key: 'joy', label: '愉悦', emoji: '😊' },
  { key: 'anger', label: '愤怒', emoji: '😠' },
  { key: 'sadness', label: '悲伤', emoji: '😢' },
  { key: 'calm', label: '平静', emoji: '😌' },
  { key: 'anxiety', label: '焦虑', emoji: '😰' },
  { key: 'focus', label: '专注', emoji: '🎯' },
  { key: 'tired', label: '疲惫', emoji: '😴' },
  { key: 'neutral', label: '中性', emoji: '😐' },
] as const
