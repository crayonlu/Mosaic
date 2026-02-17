import type { SearchMemosQuery } from '@/types/api'
import { memosApi } from '@mosaic/api'
import { useInfiniteQuery } from '@tanstack/react-query'

export function useSearchMemos(query: SearchMemosQuery) {
  return useInfiniteQuery({
    queryKey: ['memos', 'search', query],
    queryFn: ({ pageParam = 1 }) => memosApi.search({ ...query, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: lastPage => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1
      }
      return undefined
    },
  })
}
