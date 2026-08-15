import { ofetch, type FetchOptions, type FetchRequest } from "ofetch"

const TOKEN_KEY = "admin_token"
const REFRESH_KEY = "admin_refresh"
const SERVER_URL_KEY = "admin_server_url"

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access)
  localStorage.setItem(REFRESH_KEY, refresh)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

export function getServerUrl(): string {
  return localStorage.getItem(SERVER_URL_KEY) || ""
}

export function setServerUrl(url: string) {
  if (url) {
    localStorage.setItem(SERVER_URL_KEY, url.replace(/\/+$/, ""))
  } else {
    localStorage.removeItem(SERVER_URL_KEY)
  }
}

function attachToken(options: FetchOptions) {
  const token = getToken()
  if (token) {
    options.headers = new Headers(options.headers)
    options.headers.set("Authorization", `Bearer ${token}`)
  }
}

function buildUrl(basePath: string, request: FetchRequest): FetchRequest {
  if (typeof request !== "string") return request
  const server = getServerUrl()
  return server ? `${server}${basePath}${request}` : `${basePath}${request}`
}

let refreshPromise: Promise<boolean> | null = null

async function performRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const refresh = localStorage.getItem(REFRESH_KEY)
      if (!refresh) return false
      const server = getServerUrl()
      const refreshUrl = server
        ? `${server}/api/auth/refresh`
        : "/api/auth/refresh"
      const res: RefreshTokenResponse = await ofetch(refreshUrl, {
        method: "POST",
        body: { refreshToken: refresh },
      })
      setToken(res.accessToken, res.refreshToken)
      return true
    } catch {
      return false
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

/** 供鉴权媒体等非 ofetch 请求使用:刷新成功后返回新 access token,失败返回 null */
export async function refreshAccessToken(): Promise<string | null> {
  const ok = await performRefresh()
  return ok ? getToken() : null
}

const RETRY_FLAG = "__retried"

function onResponseError({
  response,
  request,
  options,
}: {
  response: Response
  request: FetchRequest
  options: FetchOptions & { [RETRY_FLAG]?: boolean }
}) {
  if (response.status === 401) {
    if (options[RETRY_FLAG]) {
      clearToken()
      window.location.href = "/admin/login"
      return
    }
    return performRefresh().then((ok) => {
      if (!ok) {
        clearToken()
        window.location.href = "/admin/login"
        return
      }
      const token = getToken()
      if (token) {
        const retryOptions: FetchOptions & { [RETRY_FLAG]?: boolean } = {
          ...options,
          [RETRY_FLAG]: true,
        }
        retryOptions.headers = new Headers(options.headers)
        ;(retryOptions.headers as Headers).set(
          "Authorization",
          `Bearer ${token}`
        )
        return ofetch(request, retryOptions)
      }
      clearToken()
      window.location.href = "/admin/login"
    })
  }
}

function createClient(basePath: string) {
  return (req: FetchRequest, opts?: FetchOptions) => {
    const url = buildUrl(basePath, req)
    const options: FetchOptions = {
      headers: { "Content-Type": "application/json" },
      onRequest(ctx: { options: FetchOptions }) {
        attachToken(ctx.options)
      },
      onResponseError,
      ...opts,
    }
    return ofetch(url, options)
  }
}

export const api = createClient("/api")
export const adminApi = createClient("/admin/api")

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: UserResponse
  mustChangePassword: boolean
}

export interface RefreshTokenResponse {
  accessToken: string
  refreshToken: string
}

export interface UserResponse {
  id: string
  username: string
  avatarUrl: string | null
  role: string
  createdAt: number
  updatedAt: number
}

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

export interface CreateUserRequest {
  username: string
  password: string
}

export interface UpdateManagedUserRequest {
  isActive?: boolean
  role?: string
  resetPassword?: string
}

export interface UsersResponse {
  users: ManagedUser[]
  total: number
  page: number
  pageSize: number
}

export interface StatsSummary {
  memos: { total: number; thisMonth: number }
  diaries: { total: number; thisMonth: number }
  resources: { total: number; totalSize: number; totalSizeFormatted: string }
  bots: { total: number; autoReply: number; totalReplies: number }
  activeDays: number
  longestStreak: number
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

export interface HealthResponse {
  uptime: string
  storageType: string
  storageUsedFormatted: string
  dbSizeFormatted: string
}

export interface MemoryStats {
  totalMemos: number
  indexedMemos: number
}

export interface BotData {
  id: string
  name: string
  description: string
  autoReply: boolean
  tags: string[]
  avatarUrl: string
  model?: string
}

export interface AutomationSettings {
  autoTagEnabled: boolean
  autoSummaryEnabled: boolean
  autoDiaryEnabled: boolean
  autoDiaryMinMemos: number
  autoDiaryMinChars: number
  appTimezone: string
}

export interface AiConfigItem {
  provider?: string
  baseUrl?: string
  apiKey?: string
  model?: string
  embeddingDim?: number | null
  maxTokens?: number | null
  supportsVision?: boolean
  supportsThinking?: boolean
}

export interface AiConfigResponse {
  bot?: AiConfigItem
  embedding?: AiConfigItem
}
