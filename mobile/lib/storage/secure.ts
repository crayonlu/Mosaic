import * as SecureStore from 'expo-secure-store'

const KEYS = {
  ACCESS_TOKEN: 'mosaic_access_token',
  REFRESH_TOKEN: 'mosaic_refresh_token',
  SERVER_URL: 'mosaic_server_url',
  USERNAME: 'mosaic_username',
} as const

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN)
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN)
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken),
    SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken),
  ])
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
    SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
  ])
}

export async function hasTokens(): Promise<boolean> {
  const token = await getAccessToken()
  return token !== null
}

export async function getServerUrl(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.SERVER_URL)
}

export async function setServerUrl(url: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.SERVER_URL, url)
}

export async function getUsername(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.USERNAME)
}

export async function setUsername(username: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.USERNAME, username)
}

export async function clearServerConfig(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.SERVER_URL),
    SecureStore.deleteItemAsync(KEYS.USERNAME),
  ])
}
