import { create } from 'zustand'

interface CacheState {
  isReady: boolean
  setReady: (value: boolean) => void
}

export const useCacheStore = create<CacheState>(set => ({
  isReady: false,
  setReady: (value: boolean) => set({ isReady: value }),
}))
