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
}
