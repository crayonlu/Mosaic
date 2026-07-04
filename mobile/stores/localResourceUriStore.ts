import { create } from 'zustand'

const MAX_ENTRIES = 200

interface LocalResourceUriState {
  // resourceId -> local file:// URI of the freshly-uploaded asset.
  // Session-only: picker URIs are temporary, so we never persist this.
  localUriByResourceId: Record<string, string>
  setLocalUri: (resourceId: string, localUri: string) => void
  clearLocalUri: (resourceId: string) => void
}

export const useLocalResourceUriStore = create<LocalResourceUriState>(set => ({
  localUriByResourceId: {},
  setLocalUri: (resourceId, localUri) =>
    set(state => {
      if (state.localUriByResourceId[resourceId] === localUri) return state
      const next = { ...state.localUriByResourceId, [resourceId]: localUri }
      const entries = Object.entries(next)
      if (entries.length > MAX_ENTRIES) {
        // Drop oldest inserts beyond the cap.
        const trimmed = Object.fromEntries(entries.slice(-MAX_ENTRIES))
        return { localUriByResourceId: trimmed }
      }
      return { localUriByResourceId: next }
    }),
  clearLocalUri: resourceId =>
    set(state => {
      if (!(resourceId in state.localUriByResourceId)) return state
      const next = { ...state.localUriByResourceId }
      delete next[resourceId]
      return { localUriByResourceId: next }
    }),
}))
