import { clearAuthHeadersCache } from '@/hooks/useAuthHeaders'
import i18n from '@/lib/i18n'
import { tokenStorage } from '@/lib/services/tokenStorage'
import { mmkvZustandStorage } from '@/lib/storage/mmkv'
import type { ApiError, User } from '@mosaic/api'
import { apiClient, authApi } from '@mosaic/api'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  isInitialized: boolean
  user: User | null
  serverUrl: string | null
  error: string | null
  mustChangePassword: boolean
}

interface AuthActions {
  initialize: () => Promise<void>
  login: (url: string, username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  testConnection: (url: string) => Promise<boolean>
  clearError: () => void
  clearMustChangePassword: () => void
}

type AuthStore = AuthState & AuthActions

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  user: null,
  serverUrl: null,
  error: null,
  mustChangePassword: false,
}

apiClient.setTokenStorage({
  getAccessToken: () => tokenStorage.getAccessToken(),
  getRefreshToken: () => tokenStorage.getRefreshToken(),
  setTokens: (accessToken: string, refreshToken: string) => {
    clearAuthHeadersCache()
    return tokenStorage.setTokens(accessToken, refreshToken)
  },
  clearTokens: () => {
    clearAuthHeadersCache()
    return tokenStorage.clearTokens()
  },
})

const savedServerUrl = tokenStorage.getServerUrl()
if (savedServerUrl) {
  try {
    apiClient.setBaseUrl(savedServerUrl)
  } catch {
    console.warn('[authStore] Failed to set base URL from saved server URL')
  }
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      initialize: async () => {
        if (get().isInitialized) return

        set({ isLoading: true })

        try {
          const serverUrl = await tokenStorage.getServerUrlAsync()
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
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Auth timeout')), 8000)
            )
            const user = await Promise.race([authApi.me(), timeoutPromise])
            set({
              isAuthenticated: true,
              isInitialized: true,
              isLoading: false,
              user,
              serverUrl,
              mustChangePassword: user.mustChangePassword ?? false,
              error: null,
            })
          } catch (error) {
            const apiError = error as ApiError

            if (apiError?.status === 401) {
              await tokenStorage.clearTokens()
              set({
                isAuthenticated: false,
                isInitialized: true,
                isLoading: false,
                user: null,
                serverUrl,
                error: null,
              })
              return
            }

            // Keep session state during transient startup failures (network/race/timeout),
            // so users are not incorrectly redirected to setup.
            set({
              isAuthenticated: true,
              isInitialized: true,
              isLoading: false,
              user: get().user,
              serverUrl,
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
          tokenStorage.setServerUrl(normalizedUrl)
          tokenStorage.setUsername(username)

          set({
            isAuthenticated: true,
            isLoading: false,
            user: response.user,
            serverUrl: normalizedUrl,
            error: null,
            mustChangePassword: response.mustChangePassword ?? false,
          })
        } catch (error) {
          const apiError = error as ApiError
          set({
            isLoading: false,
            error: apiError.error || i18n.t('authStore.loginFailed'),
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
          set({ user, mustChangePassword: user.mustChangePassword ?? false })
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

      clearMustChangePassword: () => {
        set({ mustChangePassword: false })
      },
    }),
    {
      name: 'mosaic-auth-store',
      storage: createJSONStorage(() => mmkvZustandStorage),
      partialize: state => ({
        serverUrl: state.serverUrl,
      }),
    }
  )
)
