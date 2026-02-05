import { apiClient, authApi } from '@/lib/api'
import { tokenStorage } from '@/lib/services/token-storage'
import type { ApiError } from '@/types/api'
import type { User } from '@/types/user'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  isInitialized: boolean
  user: User | null
  serverUrl: string | null
  error: string | null
}

interface AuthActions {
  initialize: () => Promise<void>
  login: (url: string, username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  testConnection: (url: string) => Promise<boolean>
  clearError: () => void
}

type AuthStore = AuthState & AuthActions

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  user: null,
  serverUrl: null,
  error: null,
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      initialize: async () => {
        if (get().isInitialized) return

        set({ isLoading: true })

        try {
          const serverUrl = await tokenStorage.getServerUrl()
          const hasTokens = await tokenStorage.hasTokens()

          if (!serverUrl || !hasTokens) {
            set({
              isInitialized: true,
              isLoading: false,
              isAuthenticated: false,
            })
            return
          }

          apiClient.setBaseUrl(serverUrl)

          try {
            const user = await authApi.me()
            set({
              isAuthenticated: true,
              isInitialized: true,
              isLoading: false,
              user,
              serverUrl,
              error: null,
            })
          } catch {
            await tokenStorage.clearTokens()
            set({
              isAuthenticated: false,
              isInitialized: true,
              isLoading: false,
              user: null,
              error: null,
            })
          }
        } catch {
          set({
            isInitialized: true,
            isLoading: false,
            isAuthenticated: false,
            error: null,
          })
        }
      },

      login: async (url: string, username: string, password: string) => {
        set({ isLoading: true, error: null })

        try {
          const normalizedUrl = url.replace(/\/$/, '')
          apiClient.setBaseUrl(normalizedUrl)

          const response = await authApi.login({ username, password })

          await tokenStorage.setTokens(response.accessToken, response.refreshToken)
          await tokenStorage.setServerUrl(normalizedUrl)
          await tokenStorage.setUsername(username)

          set({
            isAuthenticated: true,
            isLoading: false,
            user: response.user,
            serverUrl: normalizedUrl,
            error: null,
          })
        } catch (error) {
          const apiError = error as ApiError
          set({
            isLoading: false,
            error: apiError.error || '登录失败',
          })
          throw error
        }
      },

      logout: async () => {
        await tokenStorage.clearAll()
        set({
          ...initialState,
          isInitialized: true,
        })
      },

      refreshUser: async () => {
        try {
          const user = await authApi.me()
          console.log('Refreshed user:', user)
          set({ user })
        } catch (error) {
          const apiError = error as ApiError
          if (apiError.status === 401) {
            await get().logout()
          }
        }
      },

      testConnection: async (url: string) => {
        return authApi.testConnection(url)
      },

      clearError: () => {
        set({ error: null })
      },
    }),
    {
      name: 'mosaic-auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        serverUrl: state.serverUrl,
      }),
    }
  )
)
