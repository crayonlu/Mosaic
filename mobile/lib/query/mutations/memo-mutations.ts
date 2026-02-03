import { useMutation, useQueryClient } from '@tanstack/react-query'
import { memosApi } from '@/lib/api/memos'
import type { CreateMemoRequest, UpdateMemoRequest } from '@/types/api'

export function useCreateMemo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateMemoRequest) => memosApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memos'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useUpdateMemo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMemoRequest }) =>
      memosApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['memo', id] })
      queryClient.invalidateQueries({ queryKey: ['memos'] })
    },
  })
}

export function useDeleteMemo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => memosApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memos'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useArchiveMemo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => memosApi.archive(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['memo', id] })
      queryClient.invalidateQueries({ queryKey: ['memos'] })
    },
  })
}

export function useUnarchiveMemo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => memosApi.unarchive(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['memo', id] })
      queryClient.invalidateQueries({ queryKey: ['memos'] })
    },
  })
}
