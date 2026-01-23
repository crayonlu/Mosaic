import type { MoodKey } from '@/types/diary'

export const MOOD_EMOJIS: Record<string, { emoji: string; label: string }> = {
  joy: { emoji: '😊', label: '愉悦' },
  anger: { emoji: '😠', label: '愤怒' },
  sadness: { emoji: '😢', label: '悲伤' },
  calm: { emoji: '😌', label: '平静' },
  anxiety: { emoji: '😰', label: '焦虑' },
  focus: { emoji: '🎯', label: '专注' },
  tired: { emoji: '😴', label: '疲惫' },
  neutral: { emoji: '😐', label: '中性' },
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
  return MOOD_EMOJIS[moodKey]?.emoji || '😐'
}

export function getMoodLabel(moodKey?: MoodKey | string): string {
  if (!moodKey) return '未知'
  return MOOD_LABELS[moodKey] || moodKey
}

export function getMoodColor(moodKey?: string): string {
  const colors: Record<string, string> = {
    happy: '#22c55e',
    sad: '#3b82f6',
    angry: '#ef4444',
    anxious: '#f59e0b',
    calm: '#06b6d4',
    excited: '#f97316',
    tired: '#6b7280',
    neutral: '#8b5cf6',
  }
  return colors[moodKey || ''] || colors.neutral
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
