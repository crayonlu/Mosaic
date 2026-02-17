import type { ListMemosQuery } from '@/types/api'
import { memosApi } from '@mosaic/api'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

export function useMemos(query: ListMemosQuery = {}) {
  return useQuery({
    queryKey: ['memos', query],
    queryFn: () => memosApi.list(query as any),
  })
}

export function useInfiniteMemos(query: ListMemosQuery = {}) {
  return useInfiniteQuery({
    queryKey: ['memos', 'infinite', query],
    queryFn: ({ pageParam = 1 }) => memosApi.list({ ...query, page: pageParam }),
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
    queryFn: () => memosApi.get(id),
    enabled: !!id,
  })
}

export function useMemosByDate(date: string, query: ListMemosQuery = {}) {
  return useQuery({
    queryKey: ['memos', 'date', date, query],
    queryFn: () => memosApi.getByDate(date, query as any),
    enabled: !!date,
  })
}
