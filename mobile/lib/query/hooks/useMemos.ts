import type { ListMemosQuery } from '@mosaic/api'
import { memosApi } from '@mosaic/api'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  withOfflineFallback,
  syncMemosPage,
  syncMemosList,
  syncSingleMemo,
  fallbackMemosList,
  fallbackMemosByDate,
  fallbackSingleMemo,
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
