import type { SearchMemosQuery } from '@mosaic/api'
import { memosApi } from '@mosaic/api'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { withOfflineFallback, syncMemosPage, fallbackSearchMemos } from '../offlineSync'

export function useSearchMemos(query: SearchMemosQuery) {
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
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1
      }
      return undefined
    },
  })
}

export function useMemoTags() {
  return useQuery({
    queryKey: ['memos', 'tags'],
    queryFn: () => memosApi.getAllTags(),
  })
}
