import type { ListDiariesQuery } from '@mosaic/api'
import { diariesApi } from '@mosaic/api'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  withOfflineFallback,
  syncDiariesPage,
  fallbackDiariesList,
  fallbackSingleDiary,
} from '../offlineSync'

export function useDiaries(query: ListDiariesQuery = {}) {
  return useInfiniteQuery({
    queryKey: ['diaries', query],
    queryFn: ({ pageParam = 1 }) => {
      const fn = withOfflineFallback(() => diariesApi.list({ ...query, page: pageParam }), {
        writeThrough: syncDiariesPage,
        fallback: () =>
          fallbackDiariesList({
            page: pageParam as number,
            pageSize: query.pageSize,
            startDate: query.startDate,
            endDate: query.endDate,
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

export function useDiary(date: string) {
  return useQuery({
    queryKey: ['diary', date],
    queryFn: withOfflineFallback(() => diariesApi.get(date), {
      fallback: () => fallbackSingleDiary(date),
    }),
    enabled: !!date,
  })
}
