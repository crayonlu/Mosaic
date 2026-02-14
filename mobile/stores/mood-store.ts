import { MoodKey } from '@/types'
import { create } from 'zustand'

interface MoodState {
  currentMood: MoodKey | undefined
  currentMoodIntensity: number
  setCurrentMood: (mood: MoodKey | undefined, intensity: number) => void
}

export const useMoodStore = create<MoodState>(set => ({
  currentMood: undefined,
  currentMoodIntensity: 5,
  setCurrentMood: (mood, intensity) => set({ currentMood: mood, currentMoodIntensity: intensity }),
}))
