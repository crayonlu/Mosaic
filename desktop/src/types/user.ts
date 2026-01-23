export interface User {
  id: string
  username: string
  avatarUrl?: string
  createdAt: number
  updatedAt: number
}

export interface UpdateUserRequest {
  username?: string
  avatarUrl?: string
}
