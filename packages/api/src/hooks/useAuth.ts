import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../auth'
import type {
  ChangePasswordRequest,
  LoginRequest,
  UpdateAvatarRequest,
  UpdateUserRequest,
} from '../types'

const DEFAULT_STALE_TIME = 5 * 60 * 1000

export function useLogin() {
  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
  })
}

export function useRefreshToken() {
  return useMutation({
    mutationFn: (refreshToken: string) => authApi.refresh(refreshToken),
  })
}

export function useUser() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
    staleTime: DEFAULT_STALE_TIME,
  })
}

export function useChangePassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ChangePasswordRequest) => authApi.changePassword(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] })
    },
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateUserRequest) => authApi.updateUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })
}

export function useUpdateAvatar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateAvatarRequest) => authApi.updateAvatar(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })
}
