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

function onResponseError({
  response,
  request,
  options,
}: {
  response: Response
  request: FetchRequest
  options: FetchOptions
}) {
  if (response.status === 401) {
    const refresh = localStorage.getItem(REFRESH_KEY)
    if (refresh) {
      return (async () => {
        try {
          const server = getServerUrl()
          const refreshUrl = server
            ? `${server}/api/auth/refresh`
            : "/api/auth/refresh"
          const res: RefreshTokenResponse = await ofetch(refreshUrl, {
            method: "POST",
            body: { refreshToken: refresh },
          })
          setToken(res.accessToken, res.refreshToken)
          options.headers = new Headers(options.headers)
          options.headers.set("Authorization", `Bearer ${res.accessToken}`)
          return ofetch(request, options)
        } catch {
          clearToken()
          window.location.href = "/admin/login"
        }
      })()
    }
    clearToken()
    window.location.href = "/admin/login"
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
}

export interface RefreshTokenResponse {
  accessToken: string
  refreshToken: string
}

export interface UserResponse {
  id: string
  username: string
  avatarUrl: string | null
  createdAt: number
  updatedAt: number
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
