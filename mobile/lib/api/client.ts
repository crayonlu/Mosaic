import { tokenStorage } from '@/lib/services/token-storage'
import type { ApiError } from '@/types/api'

const REQUEST_TIMEOUT = 30000
const REFRESH_COOLDOWN = 5000

let lastRefreshTime = 0
let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

export class ApiClient {
  private baseUrl: string = ''

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '')
  }

  getBaseUrl(): string {
    return this.baseUrl
  }

  async getHeaders(includeAuth: boolean = true): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (includeAuth) {
      const token = await tokenStorage.getAccessToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }

    return headers
  }

  private async refreshTokenIfNeeded(): Promise<boolean> {
    const now = Date.now()
    if (now - lastRefreshTime < REFRESH_COOLDOWN) {
      return false
    }

    if (isRefreshing && refreshPromise) {
      return refreshPromise
    }

    isRefreshing = true
    lastRefreshTime = now

    refreshPromise = this.doRefreshToken()

    try {
      return await refreshPromise
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  }

  private async doRefreshToken(): Promise<boolean> {
    try {
      const refreshToken = await tokenStorage.getRefreshToken()
      if (!refreshToken) {
        return false
      }

      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })

      if (!response.ok) {
        await tokenStorage.clearTokens()
        return false
      }

      const data = await response.json()
      await tokenStorage.setTokens(data.accessToken, data.refreshToken)
      return true
    } catch {
      await tokenStorage.clearTokens()
      return false
    }
  }

  async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown
      query?: Record<string, string | number | boolean | undefined>
      auth?: boolean
      retry?: boolean
    } = {}
  ): Promise<T> {
    const { body, query, auth = true, retry = true } = options

    let url = `${this.baseUrl}${path}`

    if (query) {
      const params = new URLSearchParams()
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value))
        }
      })
      const queryString = params.toString()
      if (queryString) {
        url += `?${queryString}`
      }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    try {
      const headers = await this.getHeaders(auth)

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.status === 401 && auth && retry) {
        const refreshed = await this.refreshTokenIfNeeded()
        if (refreshed) {
          return this.request<T>(method, path, { ...options, retry: false })
        }
        throw { error: 'Unauthorized', status: 401 } as ApiError
      }

      if (!response.ok) {
        let errorData: ApiError
        try {
          errorData = await response.json()
        } catch {
          errorData = { error: response.statusText, status: response.status }
        }
        throw errorData
      }

      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return undefined as T
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        throw { error: '请求超时', status: 408 } as ApiError
      }

      if ((error as ApiError).error) {
        throw error
      }

      throw { error: '网络错误', status: 0 } as ApiError
    }
  }

  async requestWithoutAuth<T>(
    method: string,
    path: string,
    options: {
      body?: unknown
      query?: Record<string, string | number | boolean | undefined>
      retry?: boolean
    } = {}
  ): Promise<T> {
    const { body, query, retry = true } = options

    let url = `${this.baseUrl}${path}`

    if (query) {
      const params = new URLSearchParams()
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value))
        }
      })
      const queryString = params.toString()
      if (queryString) {
        url += `?${queryString}`
      }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    try {
      const response = await fetch(url, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.status === 401 && retry) {
        const refreshed = await this.refreshTokenIfNeeded()
        if (refreshed) {
          return this.requestWithoutAuth<T>(method, path, { ...options, retry: false })
        }
        throw { error: 'Unauthorized', status: 401 } as ApiError
      }

      if (!response.ok) {
        let errorData: ApiError
        try {
          errorData = await response.json()
        } catch {
          errorData = { error: response.statusText, status: response.status }
        }
        throw errorData
      }

      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return undefined as T
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        throw { error: '请求超时', status: 408 } as ApiError
      }

      if ((error as ApiError).error) {
        throw error
      }

      throw { error: '网络错误', status: 0 } as ApiError
    }
  }

  async uploadFile<T>(
    path: string,
    file: { uri: string; name: string; type: string },
    additionalFields?: Record<string, string>
  ): Promise<T> {
    const formData = new FormData()
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any)

    if (additionalFields) {
      Object.entries(additionalFields).forEach(([key, value]) => {
        formData.append(key, value)
      })
    }

    const token = await tokenStorage.getAccessToken()
    const headers: HeadersInit = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT * 2)

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorData: ApiError
        try {
          errorData = await response.json()
        } catch {
          errorData = { error: response.statusText, status: response.status }
        }
        throw errorData
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        throw { error: '上传超时', status: 408 } as ApiError
      }

      if ((error as ApiError).error) {
        throw error
      }

      throw { error: '上传失败', status: 0 } as ApiError
    }
  }

  get<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>('GET', path, { query })
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, { body })
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, { body })
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path)
  }
}

export const apiClient = new ApiClient()
