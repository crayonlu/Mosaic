import { mmkv, mmkvZustandStorage } from '@/lib/storage/mmkv'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

const STORAGE_KEY = 'mosaic-image-quality-storage'

function getPersistedHighQuality(): boolean {
  const raw = mmkv.getString(STORAGE_KEY)
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw) as { state?: { useHighQualityImages?: boolean } }
    return parsed?.state?.useHighQualityImages === true
  } catch {
    return false
  }
}

interface ImageQualityState {
  useHighQualityImages: boolean
  setUseHighQualityImages: (value: boolean) => void
}

export const useImageQualityStore = create<ImageQualityState>()(
  persist(
    set => ({
      useHighQualityImages: getPersistedHighQuality(),
      setUseHighQualityImages: (value: boolean) => {
        set({ useHighQualityImages: value })
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => mmkvZustandStorage),
      partialize: state => ({ useHighQualityImages: state.useHighQualityImages }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ImageQualityState> | undefined
        return {
          ...currentState,
          useHighQualityImages: persisted?.useHighQualityImages === true,
        }
      },
    }
  )
)
