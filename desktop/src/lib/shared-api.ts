import { apiClient } from '@mosaic/api'

const API_BASE_URL_KEY = 'apiBaseUrl'
const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'

const tokenStorage = {
  async getAccessToken(): Promise<string | null> {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  },
  async getRefreshToken(): Promise<string | null> {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  },
  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  },
  async clearTokens(): Promise<void> {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },
}

export function initSharedApiClient(baseUrl?: string): void {
  const resolvedBaseUrl = baseUrl || localStorage.getItem(API_BASE_URL_KEY) || ''
  if (resolvedBaseUrl) {
    apiClient.setBaseUrl(resolvedBaseUrl)
    localStorage.setItem(API_BASE_URL_KEY, resolvedBaseUrl)
  }
  apiClient.setTokenStorage(tokenStorage)
}

export function getStoredApiBaseUrl(): string {
  return localStorage.getItem(API_BASE_URL_KEY) || ''
}

export function setStoredApiBaseUrl(url: string): void {
  localStorage.setItem(API_BASE_URL_KEY, url)
  apiClient.setBaseUrl(url)
}

export async function clearStoredAuth(): Promise<void> {
  await tokenStorage.clearTokens()
}

export async function setStoredAuthTokens(
  accessToken: string,
  refreshToken: string
): Promise<void> {
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
