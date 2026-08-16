import { apiClient } from './client'

export interface ManagedUser {
  id: string
  username: string
  avatarUrl: string | null
  role: string
  isActive: boolean
  mustChangePassword: boolean
  createdAt: number
  updatedAt: number
}

export interface PaginatedUsersResponse {
  users: ManagedUser[]
  total: number
  page: number
  pageSize: number
}

export interface CreateUserRequest {
  username: string
  password: string
}

export interface UpdateManagedUserRequest {
  isActive?: boolean
  role?: string
  resetPassword?: string
}

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
  supportsVision?: boolean
  supportsThinking?: boolean
  embeddingDim?: number
}

export interface AdminAiConfigResponse {
  bot: ServerAiConfig
  embedding: ServerAiConfig
}

export interface AppSettingsPayload {
  autoTagEnabled: boolean
  autoSummaryEnabled: boolean
  autoDiaryEnabled: boolean
  autoDiaryMinMemos: number
  autoDiaryMinChars: number
  appTimezone: string
}

export interface AdminHealthResponse {
  uptime: string
  startedAt: number
  version: string
  storageType: string
  storageUsed: number
  storageUsedFormatted: string
  dbSize: number
  dbSizeFormatted: string
}

export interface ActivityEntry {
  timestamp: number
  action: string
  entityType: string
  entityId: string | null
  level: string
  detail: string
}

export interface ActivityResponse {
  entries: ActivityEntry[]
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

  listUsers(page = 1, pageSize = 50): Promise<PaginatedUsersResponse> {
    return apiClient.get<PaginatedUsersResponse>(
      `/admin/api/users?page=${page}&page_size=${pageSize}`
    )
  },

  createUser(data: CreateUserRequest): Promise<ManagedUser> {
    return apiClient.post<ManagedUser>('/admin/api/users', data)
  },

  updateUser(id: string, data: UpdateManagedUserRequest): Promise<ManagedUser> {
    return apiClient.request<ManagedUser>('PATCH', `/admin/api/users/${id}`, { body: data })
  },

  getSettings(): Promise<AppSettingsPayload> {
    return apiClient.get<AppSettingsPayload>('/admin/api/settings')
  },

  updateSettings(data: AppSettingsPayload): Promise<AppSettingsPayload> {
    return apiClient.put<AppSettingsPayload>('/admin/api/settings', data)
  },

  health(): Promise<AdminHealthResponse> {
    return apiClient.get<AdminHealthResponse>('/admin/api/health')
  },

  activity(limit = 50, level?: string): Promise<ActivityResponse> {
    const query: Record<string, unknown> = { limit }
    if (level) {
      query.level = level
    }
    return apiClient.get<ActivityResponse>('/admin/api/activity', query)
  },
}
