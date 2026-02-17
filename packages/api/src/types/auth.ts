export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface User {
  id: string
  username: string
  avatarUrl?: string
  createdAt: number
  updatedAt: number
}

export type UserResponse = User

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse extends AuthTokens {
  user: User
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export type RefreshTokenResponse = AuthTokens

export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
}

export interface UpdateUserRequest {
  username?: string
  avatarUrl?: string
}

export interface UpdateAvatarRequest {
  avatarUrl: string
}
