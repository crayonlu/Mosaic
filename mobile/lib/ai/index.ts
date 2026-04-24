import { detectModelCapabilities } from '@mosaic/utils'
import {
  clearAIApiKey,
  clearAIConfigMetadata,
  getAIApiKey,
  getAIConfigMetadata,
  setAIApiKey,
  setAIConfigMetadata,
  type AIConfigMetadata,
} from '../storage/secure'
import { createAIAgent } from './client'
import type { AIConfig, AIProvider, AIResponse, ModelCapabilities, TagSuggestion } from './types'
import { DEFAULT_AI_CONFIG } from './types'

export { createAIAgent, DEFAULT_AI_CONFIG, detectModelCapabilities }
export type { AIConfig, AIProvider, AIResponse, ModelCapabilities, TagSuggestion }

export async function getAIConfig(): Promise<AIConfig> {
  const [apiKey, metadata] = await Promise.all([getAIApiKey(), getAIConfigMetadata()])

  if (!metadata) {
    return { ...DEFAULT_AI_CONFIG, apiKey: apiKey || '' }
  }

  return {
    provider: metadata.provider,
    apiKey: apiKey || '',
    baseUrl: metadata.baseUrl,
    model: metadata.model,
    temperature: metadata.temperature,
    maxTokens: metadata.maxTokens,
    timeout: metadata.timeout,
  }
}

export async function setAIConfig(config: AIConfig): Promise<void> {
  const metadata: AIConfigMetadata = {
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    timeout: config.timeout,
  }

  await Promise.all([setAIApiKey(config.apiKey), setAIConfigMetadata(metadata)])
}

export async function clearAIConfig(): Promise<void> {
  await Promise.all([clearAIApiKey(), clearAIConfigMetadata()])
}

export async function createAIClient() {
  const config = await getAIConfig()
  return createAIAgent(config)
}
