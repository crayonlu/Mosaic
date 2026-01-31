import AsyncStorage from '@react-native-async-storage/async-storage'

const KEYS = {
  ACCESS_TOKEN: 'mosaic_access_token',
  REFRESH_TOKEN: 'mosaic_refresh_token',
  SERVER_URL: 'mosaic_server_url',
  USERNAME: 'mosaic_username',
}

class TokenStorage {
  async getAccessToken(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.ACCESS_TOKEN)
  }

  async getRefreshToken(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.REFRESH_TOKEN)
  }

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await AsyncStorage.multiSet([
      [KEYS.ACCESS_TOKEN, accessToken],
      [KEYS.REFRESH_TOKEN, refreshToken],
    ])
  }

  async clearTokens(): Promise<void> {
    await AsyncStorage.multiRemove([KEYS.ACCESS_TOKEN, KEYS.REFRESH_TOKEN])
  }

  async getServerUrl(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.SERVER_URL)
  }

  async setServerUrl(url: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.SERVER_URL, url)
  }

  async getUsername(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.USERNAME)
  }

  async setUsername(username: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.USERNAME, username)
  }

  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove(Object.values(KEYS))
  }

  async hasTokens(): Promise<boolean> {
    const token = await this.getAccessToken()
    return token !== null
  }
}

export const tokenStorage = new TokenStorage()
