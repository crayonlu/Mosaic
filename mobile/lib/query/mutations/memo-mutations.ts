import type { CreateMemoRequest, UpdateMemoRequest } from '@mosaic/api'
import { memosApi } from '@mosaic/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'

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
    mutationFn: ({ id, diaryDate }: { id: string; diaryDate?: string }) =>
      memosApi.archive(id, diaryDate),
    onSuccess: (_, { id, diaryDate }) => {
      queryClient.invalidateQueries({ queryKey: ['memo', id] })
      queryClient.invalidateQueries({ queryKey: ['memos'] })
      queryClient.invalidateQueries({ queryKey: ['diaries'] })
      if (diaryDate) {
        queryClient.invalidateQueries({ queryKey: ['diary', diaryDate] })
      }
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
      queryClient.invalidateQueries({ queryKey: ['diaries'] })
      queryClient.invalidateQueries({ queryKey: ['diary'] })
    },
  })
}
