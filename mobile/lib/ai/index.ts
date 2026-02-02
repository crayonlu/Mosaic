import type { AIConfig, AIProvider, TagSuggestion, AIResponse } from './types'
import { DEFAULT_AI_CONFIG } from './types'
import { createAIAgent } from './client'

export type { AIConfig, AIProvider, TagSuggestion, AIResponse }
export { DEFAULT_AI_CONFIG, createAIAgent }

export async function getAIConfig(): Promise<AIConfig> {
  return DEFAULT_AI_CONFIG
}

export async function setAIConfig(config: AIConfig): Promise<void> {}

export async function clearAIConfig(): Promise<void> {}

export async function createAIClient() {
  const config = await getAIConfig()
  return createAIAgent(config)
}
