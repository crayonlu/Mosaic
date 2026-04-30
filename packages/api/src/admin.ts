import { apiClient } from './client'

export interface ServerAiConfig {
  key: 'bot' | 'embedding'
  provider: string
  baseUrl: string
  apiKey: string
  model: string
  temperature?: number
  maxTokens?: number
  timeoutSeconds?: number
  supportsVision: boolean
  supportsThinking: boolean
  embeddingDim?: number
  updatedAt: number
}

export interface ServerAiConfigPayload {
  provider: string
  baseUrl: string
  apiKey: string
  model: string
  temperature?: number
  maxTokens?: number
  timeoutSeconds?: number
  embeddingDim?: number
}

export interface AdminAiConfigResponse {
  bot: ServerAiConfig
  embedding: ServerAiConfig
}

export const adminApi = {
  getAiConfig(): Promise<AdminAiConfigResponse> {
    return apiClient.get<AdminAiConfigResponse>('/admin/api/ai-config')
  },

  updateAiConfig(key: 'bot' | 'embedding', data: ServerAiConfigPayload): Promise<ServerAiConfig> {
    return apiClient.put<ServerAiConfig>(`/admin/api/ai-config/${key}`, data)
  },

  backfillMemory(): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/admin/api/backfill-memory')
  },
}
