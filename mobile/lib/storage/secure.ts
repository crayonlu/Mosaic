import * as SecureStore from 'expo-secure-store'
import type { AIProvider } from '../ai/types'
import { mmkv } from './mmkv'

const KEYS = {
  ACCESS_TOKEN: 'mosaic_access_token',
  REFRESH_TOKEN: 'mosaic_refresh_token',
  AI_CONFIG: 'mosaic_ai_config',
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

export async function getAIApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync('mosaic_ai_api_key')
}

export async function setAIApiKey(apiKey: string): Promise<void> {
  if (apiKey) {
    await SecureStore.setItemAsync('mosaic_ai_api_key', apiKey)
  } else {
    await SecureStore.deleteItemAsync('mosaic_ai_api_key')
  }
}

export async function clearAIApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync('mosaic_ai_api_key')
}

export interface AIConfigMetadata {
  provider: AIProvider
  baseUrl: string
  model: string
  temperature: number
  maxTokens: number
  timeout: number
}

export async function getAIConfigMetadata(): Promise<AIConfigMetadata | null> {
  const stored = mmkv.getString(KEYS.AI_CONFIG)
  if (!stored) return null
  try {
    return JSON.parse(stored) as AIConfigMetadata
  } catch {
    return null
  }
}

export async function setAIConfigMetadata(config: AIConfigMetadata): Promise<void> {
  mmkv.set(KEYS.AI_CONFIG, JSON.stringify(config))
}

export async function clearAIConfigMetadata(): Promise<void> {
  mmkv.remove(KEYS.AI_CONFIG)
}
