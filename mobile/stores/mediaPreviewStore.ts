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
    set(state => ({
      originalImageKeys: {
        ...state.originalImageKeys,
        [key]: true,
      },
    }))
  },
  hasViewedOriginalImage: key => Boolean(key && get().originalImageKeys[key]),
  clearOriginalImageViews: () => set({ originalImageKeys: {} }),
}))
