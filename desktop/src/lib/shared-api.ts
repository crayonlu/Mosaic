import { useAuthStore } from '@/stores/auth-store'
import { configCommands } from '@/utils/call-rust'
import { apiClient } from '@mosaic/api'

async function syncTokensFromBackend(): Promise<void> {
  try {
    const config = await configCommands.getServerConfig()
    const accessToken = config.apiToken || null
    const refreshToken = config.refreshToken || null

    if (accessToken && refreshToken) {
      useAuthStore.getState().setTokens(accessToken, refreshToken)
    } else {
      useAuthStore.getState().clearTokens()
    }
  } catch {
    useAuthStore.getState().clearTokens()
  }
}

const tokenStorage = {
  async getAccessToken(): Promise<string | null> {
    const token = useAuthStore.getState().accessToken
    if (token) return token

    await syncTokensFromBackend()
    return useAuthStore.getState().accessToken
  },
  async getRefreshToken(): Promise<string | null> {
    const token = useAuthStore.getState().refreshToken
    if (token) return token

    await syncTokensFromBackend()
    return useAuthStore.getState().refreshToken
  },
  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    useAuthStore.getState().setTokens(accessToken, refreshToken)
    await configCommands.setAuthTokens(accessToken, refreshToken)
  },
  async clearTokens(): Promise<void> {
    useAuthStore.getState().clearTokens()
    await configCommands.clearAuthTokens()
  },
}

export function initSharedApiClient(baseUrl?: string): void {
  if (baseUrl) {
    apiClient.setBaseUrl(baseUrl)
  }
  apiClient.setTokenStorage(tokenStorage)
}

export function getApiBaseUrl(): string {
  return apiClient.getBaseUrl()
}

export function setApiBaseUrl(url: string): void {
  apiClient.setBaseUrl(url)
}

export async function clearAuth(): Promise<void> {
  await tokenStorage.clearTokens()
}

export async function setAuthTokens(accessToken: string, refreshToken: string): Promise<void> {
  await tokenStorage.setTokens(accessToken, refreshToken)
}

export function resolveApiUrl(url: string | undefined | null): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  const baseUrl = apiClient.getBaseUrl()
  return baseUrl ? `${baseUrl}${url}` : url
}
