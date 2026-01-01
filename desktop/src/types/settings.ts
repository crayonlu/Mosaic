export interface Setting {
  id: string
  key: string
  value: string
  category: string
  createdAt: number
  updatedAt: number
}

export interface SetSettingRequest {
  key: string
  value: string
  category: string
}

export interface AIConfig {
  provider: 'openai' | 'anthropic'
  baseUrl: string
  apiKey: string
  model?: string
  temperature?: number
  maxTokens?: number
  timeout?: number
}

export interface ShortcutConfig {
  showShortcut: string
  closeShortcut: string
}
