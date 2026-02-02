export type AIProvider = 'openai' | 'anthropic'

export interface AIConfig {
  provider: AIProvider
  apiKey: string
  baseUrl: string
  model: string
  temperature: number
  maxTokens: number
  timeout: number
}

export interface TagSuggestion {
  name: string
  confidence: number
}

export interface AIResponse<T> {
  data: T
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  temperature: 0.3,
  maxTokens: 1000,
  timeout: 30000,
}
