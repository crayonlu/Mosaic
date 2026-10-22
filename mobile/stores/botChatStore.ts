import { mmkvZustandStorage } from '@/lib/storage/mmkv'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

const STORAGE_KEY = 'mosaic-bot-chat-storage'
const MAX_PENDING = 20

export interface PendingBotRequest {
  requestId: string
  threadId: string
  content: string
  previewUris: string[]
  createdAt: number
}

interface BotChatState {
  pendingByThread: Record<string, PendingBotRequest>
  setPending: (request: PendingBotRequest) => void
  clearPending: (threadId: string) => void
}

export const useBotChatStore = create<BotChatState>()(
  persist(
    set => ({
      pendingByThread: {},
      setPending: request => {
        set(state => {
          const pendingByThread = {
            ...state.pendingByThread,
            [request.threadId]: request,
          }
          const entries = Object.entries(pendingByThread)
          if (entries.length > MAX_PENDING) {
            entries.sort((a, b) => a[1].createdAt - b[1].createdAt)
            return {
              pendingByThread: Object.fromEntries(entries.slice(-MAX_PENDING)),
            }
          }
          return { pendingByThread }
        })
      },
      clearPending: threadId => {
        set(state => {
          if (!state.pendingByThread[threadId]) return state
          const pendingByThread = { ...state.pendingByThread }
          delete pendingByThread[threadId]
          return { pendingByThread }
        })
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => mmkvZustandStorage),
      partialize: state => ({ pendingByThread: state.pendingByThread }),
    }
  )
)
