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

  setServerUrl(url: string): void {
    mmkv.set(KEYS.SERVER_URL, url)
  }

  getUsername(): string | null {
    return mmkv.getString(KEYS.USERNAME) ?? null
  }

  setUsername(username: string): void {
    mmkv.set(KEYS.USERNAME, username)
  }

  async clearAll(): Promise<void> {
    await secureStorage.clearTokens()
    mmkv.remove(KEYS.SERVER_URL)
    mmkv.remove(KEYS.USERNAME)
  }

  hasTokens(): Promise<boolean> {
    return secureStorage.hasTokens()
  }
}

export const tokenStorage = new TokenStorage()
