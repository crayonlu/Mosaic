import { create } from 'zustand'

interface MediaPreviewState {
  originalImageKeys: Record<string, true>
  markOriginalImageViewed: (key: string) => void
  hasViewedOriginalImage: (key: string) => boolean
  clearOriginalImageViews: () => void
}

export const useMediaPreviewStore = create<MediaPreviewState>((set, get) => ({
  originalImageKeys: {},
  markOriginalImageViewed: key => {
    if (!key) return
    set(state => {
      const keys = { ...state.originalImageKeys, [key]: true as const }
      // Cap at 200 entries
      const entries = Object.entries(keys)
      if (entries.length > 200) {
        const trimmed = Object.fromEntries(entries.slice(-200)) as Record<string, true>
        return { originalImageKeys: trimmed }
      }
      return { originalImageKeys: keys }
    })
  },
  hasViewedOriginalImage: key => Boolean(key && get().originalImageKeys[key]),
  clearOriginalImageViews: () => set({ originalImageKeys: {} }),
}))
