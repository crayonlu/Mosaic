import type { SearchMemosQuery } from '@mosaic/api'
import { memosApi } from '@mosaic/api'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  withOfflineFallback,
  syncMemosPage,
  fallbackSearchMemos,
  fallbackMemoTags,
} from '../offlineSync'

export function useSearchMemos(query: SearchMemosQuery, options?: { enabled?: boolean }) {
  const hasSearchCriteria = Boolean(
    query.query?.trim() ||
    query.tags?.length ||
    query.isArchived !== undefined ||
    query.startDate ||
    query.endDate
  )

  return useInfiniteQuery({
    queryKey: ['memos', 'search', query],
    queryFn: ({ pageParam = 1 }) => {
      const fn = withOfflineFallback(() => memosApi.search({ ...query, page: pageParam }), {
        writeThrough: syncMemosPage,
        fallback: () =>
          fallbackSearchMemos({
            query: query.query,
            tags: query.tags,
            isArchived: query.isArchived,
            page: pageParam as number,
            pageSize: query.pageSize,
          }),
      })
      return fn()
    },
    initialPageParam: 1,
    getNextPageParam: lastPage => {
      const totalPages = Math.ceil(lastPage.total / lastPage.pageSize)
      if (lastPage.page < totalPages) {
        return lastPage.page + 1
      }
      return undefined
    },
    enabled: options?.enabled ?? hasSearchCriteria,
  })
}

export function useMemoTags() {
  return useQuery({
    queryKey: ['memos', 'tags'],
    queryFn: withOfflineFallback(() => memosApi.getAllTags(), {
      fallback: () => fallbackMemoTags(),
    }),
  })
}
