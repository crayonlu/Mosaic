import type { ListDiariesQuery } from '@/types/api'
import { diariesApi } from '@mosaic/api'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

export function useDiaries(query: ListDiariesQuery = {}) {
  return useInfiniteQuery({
    queryKey: ['diaries', query],
    queryFn: ({ pageParam = 1 }) => diariesApi.list({ ...query, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: lastPage => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1
      }
      return undefined
    },
  })
}

export function useDiary(date: string) {
  return useQuery({
    queryKey: ['diary', date],
    queryFn: () => diariesApi.get(date),
    enabled: !!date,
  })
}
