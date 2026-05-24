import type { ListMemosQuery, MemoDetail, MemoWithResources } from '@mosaic/api'
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
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['memos', query],
    queryFn: withOfflineFallback(
      async () => {
        const data = await memosApi.list(query as any)
        // Normalize: seed individual memo caches from list response
        for (const memo of data.items ?? []) {
          queryClient.setQueryData(['memo', memo.id], memo)
        }
        return data
      },
      {
        writeThrough: syncMemosPage,
        fallback: () =>
          fallbackMemosList({
            page: query.page,
            pageSize: query.pageSize,
            archived: query.archived,
            diaryDate: query.diaryDate,
          }),
      }
    ),
  })
}

export function useInfiniteMemos(query: ListMemosQuery = {}) {
  const queryClient = useQueryClient()
  return useInfiniteQuery({
    queryKey: ['memos', 'infinite', query],
    queryFn: ({ pageParam = 1 }) => {
      const fn = withOfflineFallback(
        async () => {
          const data = await memosApi.list({ ...query, page: pageParam })
          // Normalize: seed individual memo caches from each page
          for (const memo of data.items ?? []) {
            queryClient.setQueryData(['memo', memo.id], memo)
          }
          return data
        },
        {
          writeThrough: syncMemosPage,
          fallback: () =>
            fallbackMemosList({
              page: pageParam as number,
              pageSize: query.pageSize,
              archived: query.archived,
              diaryDate: query.diaryDate,
            }),
        }
      )
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
    staleTime: 5 * 60 * 1000, // 5 min: list write-through keeps it fresh
  })
}

/**
 * Consolidated detail query — returns memo + revisions + bot replies in one shot.
 * Uses placeholderData from the list cache so content appears instantly.
 */
export function useMemoDetail(id: string) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['memo', id, 'detail'],
    queryFn: withOfflineFallback<MemoDetail>(() => memosApi.getDetail(id), {
      writeThrough: async data => {
        await syncSingleMemo(data.memo)
      },
      fallback: async () => {
        const memo = await fallbackSingleMemo(id)
        if (!memo) return undefined
        return { memo, revisions: [], botReplies: [] } satisfies MemoDetail
      },
    }),
    enabled: !!id,
    staleTime: 60 * 1000,
    placeholderData: () => {
      // Check normalized cache first (fastest path)
      const cached = queryClient.getQueryData<MemoWithResources>(['memo', id])
      if (cached) {
        return { memo: cached, revisions: [], botReplies: [] } satisfies MemoDetail
      }
      // Fallback: scan list caches (legacy path)
      const listData = queryClient.getQueriesData<{ pages: { items: MemoWithResources[] }[] }>({
        queryKey: ['memos', 'infinite'],
      })
      for (const [, data] of listData) {
        if (!data?.pages) continue
        for (const page of data.pages) {
          const found = page.items.find(m => m.id === id)
          if (found) {
            return { memo: found, revisions: [], botReplies: [] } satisfies MemoDetail
          }
        }
      }
      const flatData = queryClient.getQueriesData<{ items: MemoWithResources[] }>({
        queryKey: ['memos'],
      })
      for (const [, data] of flatData) {
        if (!data?.items) continue
        const found = data.items.find(m => m.id === id)
        if (found) {
          return { memo: found, revisions: [], botReplies: [] } satisfies MemoDetail
        }
      }
      return undefined
    },
  })
}

export function useMemosByDate(date: string, query: ListMemosQuery = {}) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['memos', 'date', date, query],
    queryFn: withOfflineFallback(
      async () => {
        const data = await memosApi.getByDate(date, query as any)
        // Normalize: seed individual memo caches from date query
        for (const memo of data ?? []) {
          queryClient.setQueryData(['memo', memo.id], memo)
        }
        return data
      },
      {
        writeThrough: syncMemosList,
        fallback: () => fallbackMemosByDate(date),
      }
    ),
    enabled: !!date,
  })
}

export function useRevisions(memoId: string) {
  return useQuery({
    queryKey: ['memo', memoId, 'revisions'],
    queryFn: () => memosApi.getRevisions(memoId),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!memoId,
  })
}

export function useDeleteRevision() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ memoId, revisionId }: { memoId: string; revisionId: string }) =>
      memosApi.deleteRevision(memoId, revisionId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['memo', variables.memoId, 'detail'] })
      queryClient.invalidateQueries({ queryKey: ['memo', variables.memoId, 'revisions'] })
      queryClient.invalidateQueries({ queryKey: ['memo', variables.memoId] })
      queryClient.invalidateQueries({ queryKey: ['memos'] })
    },
  })
}
