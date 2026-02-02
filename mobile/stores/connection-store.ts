import { create } from 'zustand'
import { useAuthStore } from './auth-store'

interface ConnectionState {
  isConnected: boolean
  isServerReachable: boolean
  lastConnectedAt: string | null
  checkInterval: number
}

interface ConnectionStore extends ConnectionState {
  setConnected: (connected: boolean) => void
  setServerReachable: (reachable: boolean) => void
  updateLastConnectedAt: () => void
  initialize: () => Promise<void>
  cleanup: () => void
  checkServerReachability: () => Promise<void>
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  isConnected: true,
  isServerReachable: true,
  lastConnectedAt: null,
  checkInterval: 30000,

  setConnected: (connected) => {
    set({ isConnected: connected })
    if (connected) {
      get().updateLastConnectedAt()
    }
  },

  setServerReachable: (reachable) => {
    set({ isServerReachable: reachable })
    if (reachable) {
      get().updateLastConnectedAt()
    }
  },

  updateLastConnectedAt: () => {
    const now = new Date().toISOString()
    set({ lastConnectedAt: now })
  },

  initialize: async () => {
    get().checkServerReachability()
  },

  cleanup: () => {},

  checkServerReachability: async () => {
    const serverUrl = useAuthStore.getState().serverUrl
    if (!serverUrl) {
      set({ isServerReachable: false, isConnected: false })
      return
    }

    const normalizedUrl = serverUrl.replace(/\/$/, '')
    const healthUrl = `${normalizedUrl}/health`
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      get().setServerReachable(response.ok)
      get().setConnected(response.ok)
    } catch (error: any) {
      console.log('error', error)
      get().setServerReachable(false)
      get().setConnected(false)
    }
  },
}))
