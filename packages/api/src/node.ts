// Node-safe API exports (no React Query hooks).
// Import from '@mosaic/api/node' in non-React (Node/Bun) environments.
export {
  adminApi,
  type ActivityEntry,
  type ActivityResponse,
  type AdminAiConfigResponse,
  type AdminHealthResponse,
  type AppSettingsPayload,
  type CreateUserRequest as AdminCreateUserRequest,
  type ManagedUser,
  type PaginatedUsersResponse,
  type ServerAiConfig,
  type ServerAiConfigPayload,
  type UpdateManagedUserRequest,
} from './admin'
export { aiApi, type SuggestTagsResponse, type SummarizeResponse } from './ai'
export { authApi } from './auth'
export { botsApi } from './bots'
export { ApiClient, apiClient, type TokenStorage } from './client'
export { diariesApi } from './diaries'
export { memoryApi } from './memory'
export { memosApi } from './memos'
export { resourcesApi, toAbsoluteUrl, uploadResourceFiles } from './resources'
export { statsApi } from './stats'

// Type exports
export * from './types'
