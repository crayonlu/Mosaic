import { useInfiniteQuery } from '@tanstack/react-query'
import { memosApi } from '@/lib/api/memos'
import type { SearchMemosQuery } from '@/types/api'

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
