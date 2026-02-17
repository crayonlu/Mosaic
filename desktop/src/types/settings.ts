// Desktop-specific settings types (not in shared package)
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

// Desktop server config with AI settings (not in shared package)
export interface ServerConfig {
  url: string
  username: string
  password: string
  apiToken?: string
  refreshToken?: string
  aiProvider?: 'openai' | 'anthropic'
  aiBaseUrl?: string
  aiApiKey?: string
}
