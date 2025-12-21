export interface User {
  id: string
  username: string
  avatarPath?: string
  avatarUrl?: string
  createdAt: number
  updatedAt: number
}

export interface UpdateUserRequest {
  username?: string
  avatarPath?: string
  avatarUrl?: string
}
