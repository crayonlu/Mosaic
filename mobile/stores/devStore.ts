import { mmkvZustandStorage } from '@/lib/storage/mmkv'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface DevState {
  /** Whether to show the floating real-time FPS pill. */
  showFps: boolean
  setShowFps: (show: boolean) => void
}

export const useDevStore = create<DevState>()(
  persist(
    set => ({
      showFps: true,
      setShowFps: showFps => set({ showFps }),
    }),
    {
      name: 'mosaic-dev-storage',
      storage: createJSONStorage(() => mmkvZustandStorage),
    }
  )
)
