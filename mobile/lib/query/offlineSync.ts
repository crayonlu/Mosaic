import type { Diary, MemoWithResources, PaginatedResponse, SearchMemosResponse } from '@mosaic/api'
import {
  upsertDiaries,
  upsertMemos,
  upsertResources,
  listMemos as localListMemos,
  countMemos as localCountMemos,
  listDiaries as localListDiaries,
  countDiaries as localCountDiaries,
  countSearchMemos as localCountSearchMemos,
  getAllTags as localGetAllTags,
  getDiary as localGetDiary,
  getDiaryWithMemos as localGetDiaryWithMemos,
  getMemo as localGetMemo,
  searchMemos as localSearchMemos,
  getResourcesByMemoIds,
  type LocalMemoQuery,
  type LocalDiaryQuery,
  type LocalMemoSearchQuery,
} from '@/lib/storage/repositories'

/**
 * Wraps a network queryFn with SQLite write-through and offline fallback.
 * On success: writes data to SQLite and returns the network response.
 * On failure: falls back to SQLite data (returns it as stale).
 */
export function withOfflineFallback<T>(
  networkFn: () => Promise<T>,
  opts: {
    writeThrough?: (data: T) => Promise<void>
    fallback?: () => Promise<T | undefined>
  }
): () => Promise<T> {
  return async () => {
    try {
      const data = await networkFn()
      if (opts.writeThrough) {
        opts.writeThrough(data).catch(e => console.warn('SQLite write-through failed:', e))
      }
      return data
    } catch (error) {
      if (opts.fallback) {
        const cached = await opts.fallback()
        if (cached !== undefined) return cached
      }
      throw error
    }
  }
}

// ─── Write-through helpers ───

export async function syncMemosPage(
  response: PaginatedResponse<MemoWithResources> | SearchMemosResponse
) {
  try {
    const memos = 'items' in response ? response.items : response.memos
    await upsertMemos(memos)

    const resources = memos.flatMap(m => m.resources ?? [])
    if (resources.length > 0) {
      await upsertResources(resources)
    }
  } catch (error) {
    console.warn('[syncMemosPage] Failed to sync:', error)
  }
}

export async function syncMemosList(memos: MemoWithResources[]) {
  try {
    await upsertMemos(memos)

    const resources = memos.flatMap(m => m.resources ?? [])
    if (resources.length > 0) {
      await upsertResources(resources)
    }
  } catch (error) {
    console.warn('[syncMemosList] Failed to sync:', error)
  }
}

export async function syncSingleMemo(memo: MemoWithResources) {
  try {
    await upsertMemos([memo])
    if (memo.resources.length > 0) {
      await upsertResources(memo.resources)
    }
  } catch (error) {
    console.warn('[syncSingleMemo] Failed to sync:', error)
  }
}

export async function syncDiariesPage(response: PaginatedResponse<Diary>) {
  try {
    await upsertDiaries(response.items)
  } catch (error) {
    console.warn('[syncDiariesPage] Failed to sync:', error)
  }
}

export async function syncSingleDiary(diary: Diary) {
  try {
    await upsertDiaries([diary])
  } catch (error) {
    console.warn('[syncSingleDiary] Failed to sync:', error)
  }
}

// ─── Offline fallback helpers ───

export async function fallbackMemosList(
  query: LocalMemoQuery
): Promise<PaginatedResponse<MemoWithResources> | undefined> {
  const pageSize = query.pageSize ?? 20
  const page = query.page ?? 1

  const [memos, total] = await Promise.all([
    localListMemos(query),
    localCountMemos({ archived: query.archived, diaryDate: query.diaryDate, tag: query.tag }),
  ])

  if (memos.length === 0 && page === 1) return undefined

  const resourcesByMemoId = await getResourcesByMemoIds(memos.map(m => m.id))
  const memosWithResources: MemoWithResources[] = memos.map(m => ({
    ...m,
    resources: resourcesByMemoId.get(m.id) ?? [],
  }))

  return {
    items: memosWithResources,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function fallbackMemosByDate(date: string): Promise<MemoWithResources[] | undefined> {
  const memos = await localListMemos({ diaryDate: date, pageSize: 100 })
  if (memos.length === 0) return undefined

  const resourcesByMemoId = await getResourcesByMemoIds(memos.map(m => m.id))
  return memos.map(m => ({
    ...m,
    resources: resourcesByMemoId.get(m.id) ?? [],
  }))
}

export async function fallbackSingleMemo(id: string): Promise<MemoWithResources | undefined> {
  const memo = await localGetMemo(id)
  return memo ?? undefined
}

export async function fallbackDiariesList(
  query: LocalDiaryQuery
): Promise<PaginatedResponse<Diary> | undefined> {
  const pageSize = query.pageSize ?? 20
  const page = query.page ?? 1

  const [diaries, total] = await Promise.all([
    localListDiaries(query),
    localCountDiaries({ startDate: query.startDate, endDate: query.endDate }),
  ])

  if (diaries.length === 0 && page === 1) return undefined

  return {
    items: diaries,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function fallbackSingleDiary(date: string): Promise<any | undefined> {
  return (await localGetDiaryWithMemos(date)) ?? undefined
}

export async function fallbackSearchMemos(
  query: LocalMemoSearchQuery
): Promise<SearchMemosResponse | undefined> {
  const pageSize = query.pageSize ?? 20
  const page = query.page ?? 1

  const [memos, total] = await Promise.all([
    localSearchMemos(query),
    localCountSearchMemos({
      query: query.query,
      tags: query.tags,
      startDate: query.startDate,
      endDate: query.endDate,
      isArchived: query.isArchived,
    }),
  ])

  if (memos.length === 0 && page === 1) return undefined

  const resourcesByMemoId = await getResourcesByMemoIds(memos.map(m => m.id))
  const memosWithResources: MemoWithResources[] = memos.map(m => ({
    ...m,
    resources: resourcesByMemoId.get(m.id) ?? [],
  }))

  return {
    memos: memosWithResources,
    total,
    page,
    pageSize,
    semanticEnabled: false,
  }
}

// ─── Tags fallback ───

export async function fallbackMemoTags(): Promise<{ tag: string; count: number }[] | undefined> {
  const tags = await localGetAllTags()
  if (tags.length === 0) return undefined
  return tags
}
