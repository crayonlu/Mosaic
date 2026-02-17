import type { QueryClient } from '@tanstack/react-query'
import axios from 'axios'
import type { ApiError, RefreshTokenResponse, UploadFile } from './types'

const REQUEST_TIMEOUT = 30000
const UPLOAD_TIMEOUT = 60000
const REFRESH_COOLDOWN = 5000

export interface TokenStorage {
  getAccessToken(): Promise<string | null>
  getRefreshToken(): Promise<string | null>
  setTokens(accessToken: string, refreshToken: string): Promise<void>
  clearTokens(): Promise<void>
}

export class ApiClient {
  private baseUrl: string = ''
  private queryClient: QueryClient | null = null
  private tokenStorage: TokenStorage | null = null
  private readonly httpClient = axios.create({
    timeout: REQUEST_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  private lastRefreshTime = 0
  private isRefreshing = false
  private refreshPromise: Promise<boolean> | null = null

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '')
    this.httpClient.defaults.baseURL = this.baseUrl
  }

  getBaseUrl(): string {
    return this.baseUrl
  }

  setQueryClient(client: QueryClient): void {
    this.queryClient = client
  }

  getQueryClient(): QueryClient | null {
    return this.queryClient
  }

  setTokenStorage(storage: TokenStorage): void {
    this.tokenStorage = storage
  }

  getTokenStorage(): TokenStorage | null {
    return this.tokenStorage
  }

  private async getHeaders(includeAuth: boolean = true): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (includeAuth && this.tokenStorage) {
      const token = await this.tokenStorage.getAccessToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }

    return headers
  }

  private async refreshTokenIfNeeded(): Promise<boolean> {
    const now = Date.now()
    if (now - this.lastRefreshTime < REFRESH_COOLDOWN) {
      return false
    }

    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise
    }

    this.isRefreshing = true
    this.lastRefreshTime = now

    this.refreshPromise = this.doRefreshToken()

    try {
      return await this.refreshPromise
    } finally {
      this.isRefreshing = false
      this.refreshPromise = null
    }
  }

  private async doRefreshToken(): Promise<boolean> {
    if (!this.tokenStorage) {
      return false
    }

    try {
      const refreshToken = await this.tokenStorage.getRefreshToken()
      if (!refreshToken) {
        return false
      }

      const response = await axios.post<RefreshTokenResponse>(
        `${this.baseUrl}/api/auth/refresh`,
        { refreshToken },
        {
          timeout: REQUEST_TIMEOUT,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (response.status !== 200) {
        await this.tokenStorage.clearTokens()
        return false
      }

      const data = response.data
      await this.tokenStorage.setTokens(data.accessToken, data.refreshToken)
      return true
    } catch {
      await this.tokenStorage.clearTokens()
      return false
    }
  }

  async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown
      query?: Record<string, unknown>
      auth?: boolean
      retry?: boolean
    } = {}
  ): Promise<T> {
    const { body, query, auth = true, retry = true } = options

    try {
      const headers = await this.getHeaders(auth)

      const response = await this.httpClient.request<T>({
        url: path,
        method,
        headers,
        data: body,
        params: query,
        timeout: REQUEST_TIMEOUT,
      })

      if (response.status === 204) {
        return undefined as T
      }

      return response.data
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401 && auth && retry) {
        const refreshed = await this.refreshTokenIfNeeded()
        if (refreshed) {
          return this.request<T>(method, path, { ...options, retry: false })
        }
        throw { error: 'Unauthorized', status: 401 } as ApiError
      }

      if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        throw { error: '请求超时', status: 408 } as ApiError
      }

      if (axios.isAxiosError(error) && error.response) {
        const responseData = error.response.data as ApiError | undefined
        if (responseData && typeof responseData.error === 'string') {
          throw responseData
        }

        throw {
          error: error.response.statusText || '请求失败',
          status: error.response.status,
        } as ApiError
      }

      if ((error as ApiError).error) {
        throw error
      }

      throw { error: '网络错误', status: 0 } as ApiError
    }
  }

  async uploadFile<T>(
    path: string,
    file: UploadFile,
    additionalFields?: Record<string, string>
  ): Promise<T> {
    const formData = new FormData()
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as unknown as Blob)

    if (additionalFields) {
      Object.entries(additionalFields).forEach(([key, value]) => {
        formData.append(key, value)
      })
    }

    const headers: Record<string, string> = {}
    if (this.tokenStorage) {
      const token = await this.tokenStorage.getAccessToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }

    try {
      const response = await this.httpClient.request<T>({
        url: path,
        method: 'POST',
        headers,
        data: formData,
        timeout: UPLOAD_TIMEOUT,
      })

      return response.data
    } catch (error) {
      if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        throw { error: '上传超时', status: 408 } as ApiError
      }

      if (axios.isAxiosError(error) && error.response) {
        const responseData = error.response.data as ApiError | undefined
        if (responseData && typeof responseData.error === 'string') {
          throw responseData
        }

        throw {
          error: error.response.statusText || '上传失败',
          status: error.response.status,
        } as ApiError
      }

      if ((error as ApiError).error) {
        throw error
      }

      throw { error: '上传失败', status: 0 } as ApiError
    }
  }

  get<T>(path: string, query?: Record<string, unknown>): Promise<T> {
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
