import type { ListMemosQuery } from '@mosaic/api'
import { memosApi } from '@mosaic/api'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fallbackMemosByDate,
  fallbackMemosList,
  fallbackSingleMemo,
  syncMemosList,
  syncMemosPage,
  syncSingleMemo,
  withOfflineFallback,
} from '../offlineSync'

export function useMemos(query: ListMemosQuery = {}) {
  return useQuery({
    queryKey: ['memos', query],
    queryFn: withOfflineFallback(() => memosApi.list(query as any), {
      writeThrough: syncMemosPage,
      fallback: () =>
        fallbackMemosList({
          page: query.page,
          pageSize: query.pageSize,
          archived: query.archived,
          diaryDate: query.diaryDate,
        }),
    }),
  })
}

export function useInfiniteMemos(query: ListMemosQuery = {}) {
  return useInfiniteQuery({
    queryKey: ['memos', 'infinite', query],
    queryFn: ({ pageParam = 1 }) => {
      const fn = withOfflineFallback(() => memosApi.list({ ...query, page: pageParam }), {
        writeThrough: syncMemosPage,
        fallback: () =>
          fallbackMemosList({
            page: pageParam as number,
            pageSize: query.pageSize,
            archived: query.archived,
            diaryDate: query.diaryDate,
          }),
      })
      return fn()
    },
    initialPageParam: 1,
    getNextPageParam: lastPage => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1
      }
      return undefined
    },
  })
}

export function useMemo(id: string) {
  return useQuery({
    queryKey: ['memo', id],
    queryFn: withOfflineFallback(() => memosApi.get(id), {
      writeThrough: syncSingleMemo,
      fallback: () => fallbackSingleMemo(id),
    }),
    enabled: !!id,
  })
}

export function useMemosByDate(date: string, query: ListMemosQuery = {}) {
  return useQuery({
    queryKey: ['memos', 'date', date, query],
    queryFn: withOfflineFallback(() => memosApi.getByDate(date, query as any), {
      writeThrough: syncMemosList,
      fallback: () => fallbackMemosByDate(date),
    }),
    enabled: !!date,
  })
}

export function useRevisions(memoId: string) {
  return useQuery({
    queryKey: ['memo', memoId, 'revisions'],
    queryFn: () => memosApi.getRevisions(memoId),
    enabled: !!memoId,
  })
}

export function useDeleteRevision() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ memoId, revisionId }: { memoId: string; revisionId: string }) =>
      memosApi.deleteRevision(memoId, revisionId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['memo', variables.memoId, 'revisions'] })
      queryClient.invalidateQueries({ queryKey: ['memo', variables.memoId] })
      queryClient.invalidateQueries({ queryKey: ['memos'] })
    },
  })
}
