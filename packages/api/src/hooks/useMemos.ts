import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { memosApi } from '../memos'
import type {
    CreateMemoRequest,
    ListMemosQuery,
    SearchMemosQuery,
    UpdateMemoRequest,
} from '../types'

const DEFAULT_STALE_TIME = 5 * 60 * 1000

export function useMemos(query?: ListMemosQuery) {
  return useQuery({
    queryKey: ['memos', 'list', query],
    queryFn: () => memosApi.list(query),
    staleTime: DEFAULT_STALE_TIME,
  })
}

export function useMemo(id: string) {
  return useQuery({
    queryKey: ['memos', id],
    queryFn: () => memosApi.get(id),
    staleTime: DEFAULT_STALE_TIME,
    enabled: !!id,
  })
}

export function useMemoByDate(date: string, query: ListMemosQuery = {}) {
  return useQuery({
    queryKey: ['memos', 'date', date, query],
    queryFn: () => memosApi.getByDate(date, query),
    staleTime: DEFAULT_STALE_TIME,
    enabled: !!date,
  })
}

export function useSearchMemos(query: SearchMemosQuery) {
  return useQuery({
    queryKey: ['memos', 'search', query],
    queryFn: () => memosApi.search(query),
    staleTime: DEFAULT_STALE_TIME,
  })
}

export function useMemoTags() {
  return useQuery({
    queryKey: ['memos', 'tags'],
    queryFn: () => memosApi.getAllTags(),
    staleTime: DEFAULT_STALE_TIME,
  })
}

export function useCreateMemo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateMemoRequest) => memosApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memos'] })
    },
  })
}

export function useUpdateMemo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMemoRequest }) =>
      memosApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['memos'] })
      queryClient.invalidateQueries({ queryKey: ['memos', id] })
    },
  })
}

export function useDeleteMemo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => memosApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memos'] })
    },
  })
}

export function useArchiveMemo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, diaryDate }: { id: string; diaryDate?: string }) =>
      memosApi.archive(id, diaryDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memos'] })
    },
  })
}

export function useUnarchiveMemo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => memosApi.unarchive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memos'] })
    },
  })
}
