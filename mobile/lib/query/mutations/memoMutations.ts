import { toast } from '@/components/ui/Toast'
import i18n from '@/lib/i18n'
import type { CreateMemoRequest, UpdateMemoRequest } from '@mosaic/api'
import { memosApi } from '@mosaic/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useCreateMemo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateMemoRequest) => memosApi.create(data),
    onSuccess: memo => {
      // Write-through to normalized cache
      queryClient.setQueryData(['memo', memo.id], memo)
      queryClient.invalidateQueries({ queryKey: ['memos', 'infinite'] })
      queryClient.invalidateQueries({ queryKey: ['memos', 'date'] })
      queryClient.invalidateQueries({ queryKey: ['memos', 'tags'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: () => {
      toast.show({ type: 'error', title: i18n.t('memoMutations.createFailed') })
    },
  })
}

export function useUpdateMemo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMemoRequest }) =>
      memosApi.update(id, data),
    onSuccess: (memo, { id }) => {
      // Write-through to normalized cache — immediate update, no refetch
      queryClient.setQueryData(['memo', id], memo)
      queryClient.invalidateQueries({ queryKey: ['memo', id, 'detail'] })
      queryClient.invalidateQueries({ queryKey: ['memo', id, 'revisions'] })
      queryClient.invalidateQueries({ queryKey: ['memos', 'infinite'] })
      queryClient.invalidateQueries({ queryKey: ['memos', 'date'] })
      queryClient.invalidateQueries({ queryKey: ['memos', 'tags'] })
    },
  })
}

export function useDeleteMemo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => memosApi.delete(id),
    onSuccess: (_data, id) => {
      // Remove from normalized cache
      queryClient.removeQueries({ queryKey: ['memo', id] })
      queryClient.removeQueries({ queryKey: ['memo', id, 'detail'] })
      queryClient.invalidateQueries({ queryKey: ['memos', 'infinite'] })
      queryClient.invalidateQueries({ queryKey: ['memos', 'date'] })
      queryClient.invalidateQueries({ queryKey: ['memos', 'search'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: () => {
      toast.show({ type: 'error', title: i18n.t('memoMutations.deleteFailed') })
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
      queryClient.invalidateQueries({ queryKey: ['memo', id, 'detail'] })
      queryClient.invalidateQueries({ queryKey: ['memos', 'infinite'] })
      queryClient.invalidateQueries({ queryKey: ['memos', 'date'] })
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
    mutationFn: ({ id, diaryDate }: { id: string; diaryDate?: string }) => memosApi.unarchive(id),
    onSuccess: (_, { id, diaryDate }) => {
      queryClient.invalidateQueries({ queryKey: ['memo', id] })
      queryClient.invalidateQueries({ queryKey: ['memos', 'infinite'] })
      queryClient.invalidateQueries({ queryKey: ['memos', 'date'] })
      queryClient.invalidateQueries({ queryKey: ['diaries'] })
      if (diaryDate) {
        queryClient.invalidateQueries({ queryKey: ['diary', diaryDate] })
      }
    },
  })
}
