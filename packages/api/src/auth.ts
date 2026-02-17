import { apiClient } from './client'
import type {
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  UpdateAvatarRequest,
  UpdateUserRequest,
  UserResponse,
} from './types'

export const authApi = {
  login(data: LoginRequest): Promise<LoginResponse> {
    return apiClient.request<LoginResponse>('POST', '/api/auth/login', {
      body: data,
      auth: false,
    })
  },

  refresh(refreshToken: string): Promise<RefreshTokenResponse> {
    return apiClient.request<RefreshTokenResponse>('POST', '/api/auth/refresh', {
      body: { refreshToken },
      auth: false,
    })
  },

  me(): Promise<UserResponse> {
    return apiClient.get<UserResponse>('/api/auth/me')
  },

  changePassword(data: ChangePasswordRequest): Promise<void> {
    return apiClient.post<void>('/api/auth/change-password', data)
  },

  updateUser(data: UpdateUserRequest): Promise<UserResponse> {
    return apiClient.put<UserResponse>('/api/auth/update-user', data)
  },

  updateAvatar(data: UpdateAvatarRequest): Promise<UserResponse> {
    return apiClient.post<UserResponse>('/api/auth/update-avatar', data)
  },

  async testConnection(url: string): Promise<boolean> {
    try {
      const response = await fetch(`${url.replace(/\/$/, '')}/health`)
      return response.ok
    } catch {
      return false
    }
  },
}
