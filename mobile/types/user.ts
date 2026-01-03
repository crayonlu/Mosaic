/**
 * User Types
 * User account and profile management
 */

export interface User {
  id: string
  username: string
  avatarPath?: string
  avatarUrl?: string
  createdAt: number // timestamp in milliseconds
  updatedAt: number // timestamp in milliseconds
}

export interface UpdateUserRequest {
  id: string
  username?: string
  avatarPath?: string
  avatarUrl?: string
}
