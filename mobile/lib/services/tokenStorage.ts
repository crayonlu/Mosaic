import { mmkv } from '@/lib/storage/mmkv'
import * as secureStorage from '@/lib/storage/secure'

const KEYS = {
  SERVER_URL: 'mosaic_server_url',
  USERNAME: 'mosaic_username',
} as const

class TokenStorage {
  getAccessToken(): Promise<string | null> {
    return secureStorage.getAccessToken()
  }

  getRefreshToken(): Promise<string | null> {
    return secureStorage.getRefreshToken()
  }

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await secureStorage.setTokens(accessToken, refreshToken)
  }

  async clearTokens(): Promise<void> {
    await secureStorage.clearTokens()
  }

  getServerUrl(): string | null {
    return mmkv.getString(KEYS.SERVER_URL) ?? null
  }

  async getServerUrlAsync(): Promise<string | null> {
    const fromMmkv = mmkv.getString(KEYS.SERVER_URL)
    if (fromMmkv) return fromMmkv
    return secureStorage.getServerUrl()
  }

  setServerUrl(url: string): void {
    mmkv.set(KEYS.SERVER_URL, url)
    secureStorage.setServerUrl(url).catch(() => {})
  }

  getUsername(): string | null {
    return mmkv.getString(KEYS.USERNAME) ?? null
  }

  async getUsernameAsync(): Promise<string | null> {
    const fromMmkv = mmkv.getString(KEYS.USERNAME)
    if (fromMmkv) return fromMmkv
    return secureStorage.getUsername()
  }

  setUsername(username: string): void {
    mmkv.set(KEYS.USERNAME, username)
    secureStorage.setUsername(username).catch(() => {})
  }

  async clearAll(): Promise<void> {
    await Promise.all([secureStorage.clearTokens(), secureStorage.clearServerConfig()])
    mmkv.remove(KEYS.SERVER_URL)
    mmkv.remove(KEYS.USERNAME)
  }

  hasTokens(): Promise<boolean> {
    return secureStorage.hasTokens()
  }
}

export const tokenStorage = new TokenStorage()
