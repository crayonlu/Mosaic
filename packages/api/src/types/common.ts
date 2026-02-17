export interface ApiError {
  error: string
  status?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ServerConfig {
  url: string
  username: string
  password: string
}

export interface HealthResponse {
  status: string
  version: string
}
