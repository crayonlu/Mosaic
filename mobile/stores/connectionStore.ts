import { mapServerConnectionError } from '@/lib/errors/serverConnection'
import { create } from 'zustand'
import { useAuthStore } from './authStore'
import { getSyncEngine } from '@/lib/sync/engine'

interface ConnectionState {
  isConnected: boolean
  isServerReachable: boolean
  lastError: string | null
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
  lastError: null,
  lastConnectedAt: null,
  checkInterval: 30000,

  setConnected: connected => {
    set({ isConnected: connected })
    if (connected) {
      get().updateLastConnectedAt()
    }
  },

  setServerReachable: reachable => {
    const wasOffline = !get().isServerReachable
    set({ isServerReachable: reachable, lastError: reachable ? null : get().lastError })
    if (reachable) {
      get().updateLastConnectedAt()
      if (wasOffline) {
        getSyncEngine().sync()
      }
    }
  },

  updateLastConnectedAt: () => {
    const now = new Date().toISOString()
    set({ lastConnectedAt: now })
  },

  initialize: async () => {
    await get().checkServerReachability()
  },

  cleanup: () => {},

  checkServerReachability: async () => {
    const serverUrl = useAuthStore.getState().serverUrl
    if (!serverUrl) {
      set({
        isServerReachable: false,
        isConnected: false,
        lastError: '未检测到服务器配置，请先完成初始化设置。',
      })
      return
    }

    const normalizedUrl = serverUrl.replace(/\/$/, '')
    const healthUrl = `${normalizedUrl}/health`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
      })

      if (!response.ok) {
        const presentation = mapServerConnectionError(
          { status: response.status, error: `Health check failed: HTTP ${response.status}` },
          'initialize'
        )
        set({ isServerReachable: false, isConnected: false, lastError: presentation.message })
        return
      }

      set({ isServerReachable: true, isConnected: true, lastError: null })
      get().updateLastConnectedAt()
    } catch (error: any) {
      console.log('checkServerReachability error', error)
      const presentation = mapServerConnectionError(error, 'initialize')
      set({ isServerReachable: false, isConnected: false, lastError: presentation.message })
    } finally {
      clearTimeout(timeoutId)
    }
  },
}))
