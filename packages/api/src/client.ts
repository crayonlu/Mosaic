import type { QueryClient } from '@tanstack/react-query'
import axios from 'axios'
import type { ApiError, RefreshTokenResponse, UploadFile, UploadFileOptions } from './types'

const REQUEST_TIMEOUT = 30000
const UPLOAD_TIMEOUT = 300000
const REFRESH_COOLDOWN = 5000

function isNativeUploadFile(file: UploadFile): file is Extract<UploadFile, { uri: string }> {
  return 'uri' in file
}

function isReactNativeRuntime(): boolean {
  return typeof navigator !== 'undefined' && navigator.product === 'ReactNative'
}

function getUploadFileSize(file: UploadFile): number | null {
  if (typeof file.size === 'number' && Number.isFinite(file.size)) {
    return file.size
  }

  if (!isNativeUploadFile(file) && typeof file.data.size === 'number') {
    return file.data.size
  }

  return null
}

function tryParseJson<T>(value: string): T | undefined {
  try {
    return JSON.parse(value) as T
  } catch {
    return undefined
  }
}

function summarizeTextResponse(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return 'empty response body'
  }

  return normalized.slice(0, 160)
}

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
    paramsSerializer: {
      indexes: null,
    },
  })

  private lastRefreshTime = 0
  private isRefreshing = false
  private refreshPromise: Promise<boolean> | null = null
  private authFailedEmitted = false

  private requestQueue: Array<{
    resolve: (value: unknown) => void
    reject: (reason?: unknown) => void
    method: string
    path: string
    options: object
  }> = []

  onAuthFailed: (() => void) | null = null

  private enqueueRequest<T>(method: string, path: string, options: object): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        resolve: resolve as (value: unknown) => void,
        reject,
        method,
        path,
        options,
      })
    })
  }

  private flushRequestQueue(success: boolean): void {
    const queue = this.requestQueue
    this.requestQueue = []
    for (const item of queue) {
      if (success) {
        this.request(item.method, item.path, item.options).then(item.resolve).catch(item.reject)
      } else {
        item.reject({ error: 'Unauthorized', status: 401 } as ApiError)
      }
    }
  }

  private emitAuthFailed(): void {
    if (this.authFailedEmitted) return
    this.authFailedEmitted = true
    this.onAuthFailed?.()
  }

  resetAuthFailed(): void {
    this.authFailedEmitted = false
  }

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
      if (this.isRefreshing && this.refreshPromise) {
        await this.refreshPromise
      }
      const token = await this.tokenStorage.getAccessToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }

    return headers
  }

  private async refreshTokenIfNeeded(): Promise<boolean> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise
    }

    const now = Date.now()
    if (now - this.lastRefreshTime < REFRESH_COOLDOWN) {
      return false
    }

    this.isRefreshing = true
    this.lastRefreshTime = now

    this.refreshPromise = this.doRefreshToken()

    try {
      const success = await this.refreshPromise
      if (!success) {
        this.emitAuthFailed()
      }
      this.flushRequestQueue(success)
      return success
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
        if (response.status === 400 || response.status === 401) {
          await this.tokenStorage.clearTokens()
        }
        return false
      }

      const data = response.data
      await this.tokenStorage.setTokens(data.accessToken, data.refreshToken)
      return true
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status
        if (status === 400 || status === 401) {
          await this.tokenStorage.clearTokens()
        }
        return false
      }

      return false
    }
  }

  private buildAbsoluteUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) {
      return path
    }

    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
  }

  private async uploadNativeFileWithXhr<T>(
    path: string,
    file: Extract<UploadFile, { uri: string }>,
    options: UploadFileOptions = {}
  ): Promise<T> {
    const { additionalFields, onProgress } = options
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

    const url = this.buildAbsoluteUrl(path)
    const token = this.tokenStorage ? await this.tokenStorage.getAccessToken() : null

    return new Promise<T>((resolve, reject) => {
      const XmlHttpRequest = globalThis.XMLHttpRequest
      if (typeof XmlHttpRequest !== 'function') {
        reject({ error: 'Do not support native upload', status: 0 } as ApiError)
        return
      }

      const xhr = new XmlHttpRequest()
      xhr.open('POST', url)
      xhr.timeout = UPLOAD_TIMEOUT
      xhr.responseType = 'text'
      xhr.setRequestHeader('Accept', 'application/json')

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = event => {
          const total = event.lengthComputable ? event.total : getUploadFileSize(file)
          onProgress({
            loaded: event.loaded,
            total: total ?? null,
            percent:
              total && total > 0 ? Math.min(100, Math.round((event.loaded / total) * 100)) : 0,
          })
        }
      }

      xhr.onerror = () => {
        reject({ error: 'Network Error', status: 0 } as ApiError)
      }

      xhr.ontimeout = () => {
        reject({ error: 'Upload Timeout', status: 408 } as ApiError)
      }

      xhr.onload = () => {
        const rawResponse = typeof xhr.response === 'string' ? xhr.response : xhr.responseText
        const responseText = rawResponse?.trim() ?? ''
        const parsedBody = responseText ? tryParseJson<T | ApiError>(responseText) : undefined

        if (xhr.status >= 200 && xhr.status < 300) {
          if (parsedBody !== undefined) {
            resolve(parsedBody as T)
            return
          }

          reject({
            error: `Unexpected non-JSON upload response: ${summarizeTextResponse(responseText)}`,
            status: xhr.status || 0,
          } as ApiError)
          return
        }

        if (parsedBody && typeof parsedBody === 'object' && 'error' in parsedBody) {
          reject(parsedBody)
          return
        }

        reject({
          error:
            xhr.statusText ||
            (responseText
              ? `Upload Failed: ${summarizeTextResponse(responseText)}`
              : 'Upload Failed'),
          status: xhr.status || 0,
        } as ApiError)
      }

      try {
        xhr.send(formData)
      } catch (error) {
        if ((error as ApiError).error) {
          reject(error)
          return
        }

        const message = error instanceof Error ? error.message : 'Upload Failed'
        reject({ error: message, status: 0 } as ApiError)
      }
    })
  }

  async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown
      query?: Record<string, unknown>
      auth?: boolean
      retry?: boolean
      extraHeaders?: Record<string, string>
      timeout?: number
    } = {}
  ): Promise<T> {
    const { body, query, auth = true, retry = true, extraHeaders, timeout } = options

    try {
      const headers = await this.getHeaders(auth)
      if (extraHeaders) {
        Object.assign(headers, extraHeaders)
      }

      const response = await this.httpClient.request<T>({
        url: path,
        method,
        headers,
        data: body,
        params: query,
        timeout: timeout ?? REQUEST_TIMEOUT,
      })

      if (response.status === 204) {
        return undefined as T
      }

      return response.data
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401 && auth && retry) {
        if (this.isRefreshing && this.refreshPromise) {
          return this.enqueueRequest<T>(method, path, options)
        }
        const refreshed = await this.refreshTokenIfNeeded()
        if (refreshed) {
          return this.request<T>(method, path, { ...options, retry: false })
        }
        this.emitAuthFailed()
        throw { error: 'Unauthorized', status: 401 } as ApiError
      }

      if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        throw { error: 'Request Timeout', status: 408 } as ApiError
      }

      if (axios.isAxiosError(error) && error.response) {
        const responseData = error.response.data as ApiError | undefined
        if (responseData && typeof responseData.error === 'string') {
          throw responseData
        }

        throw {
          error: error.response.statusText || 'Request Failed',
          status: error.response.status,
        } as ApiError
      }

      if ((error as ApiError).error) {
        throw error
      }

      throw { error: 'Network Error', status: 0 } as ApiError
    }
  }

  async uploadFile<T>(path: string, file: UploadFile, options: UploadFileOptions = {}): Promise<T> {
    if (isReactNativeRuntime() && isNativeUploadFile(file)) {
      try {
        return await this.uploadNativeFileWithXhr<T>(path, file, options)
      } catch (error) {
        if ((error as ApiError).status === 401) {
          const refreshed = await this.refreshTokenIfNeeded()
          if (refreshed) {
            return this.uploadFile<T>(path, file, options)
          }
          throw { error: 'Unauthorized', status: 401 } as ApiError
        }

        throw error
      }
    }

    const { additionalFields, onProgress } = options
    const formData = new FormData()

    if (isNativeUploadFile(file)) {
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as unknown as Blob)
    } else {
      formData.append('file', file.data, file.name)
    }

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
        onUploadProgress: event => {
          if (!onProgress) {
            return
          }

          const total = event.total ?? getUploadFileSize(file)
          onProgress({
            loaded: event.loaded,
            total: total ?? null,
            percent:
              total && total > 0 ? Math.min(100, Math.round((event.loaded / total) * 100)) : 0,
          })
        },
      })

      return response.data
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        if (this.isRefreshing && this.refreshPromise) {
          await this.refreshPromise
          return this.uploadFile<T>(path, file, options)
        }
        const refreshed = await this.refreshTokenIfNeeded()
        if (refreshed) {
          return this.uploadFile<T>(path, file, options)
        }
        this.emitAuthFailed()
        throw { error: 'Unauthorized', status: 401 } as ApiError
      }

      if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        throw { error: 'Upload Timeout', status: 408 } as ApiError
      }

      if (axios.isAxiosError(error) && error.response) {
        const responseData = error.response.data as ApiError | undefined
        if (responseData && typeof responseData.error === 'string') {
          throw responseData
        }

        throw {
          error: error.response.statusText || 'Upload Failed',
          status: error.response.status,
        } as ApiError
      }

      if (axios.isAxiosError(error)) {
        throw {
          error: error.message || 'Network Error',
          status: 0,
        } as ApiError
      }

      if ((error as ApiError).error) {
        throw error
      }

      throw { error: 'Upload Failed', status: 0 } as ApiError
    }
  }

  get<T>(path: string, query?: Record<string, unknown>): Promise<T> {
    return this.request<T>('GET', path, { query })
  }

  post<T>(path: string, body?: unknown, timeout?: number): Promise<T> {
    return this.request<T>('POST', path, { body, timeout })
  }

  postWithHeaders<T>(
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>
  ): Promise<T> {
    return this.request<T>('POST', path, { body, extraHeaders })
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, { body })
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path)
  }
}

export const apiClient = new ApiClient()
