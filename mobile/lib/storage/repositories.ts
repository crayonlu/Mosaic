import type {
  Diary,
  DiaryWithMemos,
  Memo,
  MemoWithResources,
  Resource,
  ResourceMetadata,
} from '@mosaic/api'
import type { SQLiteDatabase } from 'expo-sqlite'
import { getDatabase } from './database'

async function withTransaction<T>(db: SQLiteDatabase, fn: () => Promise<T>): Promise<T> {
  await db.execAsync('BEGIN')
  try {
    const result = await fn()
    await db.execAsync('COMMIT')
    return result
  } catch (error) {
    try {
      await db.execAsync('ROLLBACK')
    } catch {
      // ignore rollback errors if transaction was already closed
    }
    throw error
  }
}

// Serial queue: ensures only one transaction runs at a time
let dbQueue: Promise<unknown> = Promise.resolve()

export function enqueueDbWrite<T>(fn: () => Promise<T>): Promise<T> {
  const next = dbQueue.then(() => fn()).catch(() => fn())
  dbQueue = next.catch(() => {})
  return next
}

// ─── Memos ───

export interface LocalMemoQuery {
  page?: number
  pageSize?: number
  archived?: boolean
  diaryDate?: string
  tag?: string
}

export interface LocalMemoSearchQuery {
  query: string
  tags?: string[]
  startDate?: number
  endDate?: number
  isArchived?: boolean
  page?: number
  pageSize?: number
}

export async function upsertMemo(memo: Memo): Promise<void> {
  return enqueueDbWrite(async () => {
    const db = await getDatabase()

    await withTransaction(db, async () => {
      await db.runAsync(
        `INSERT INTO memos (id, content, is_archived, diary_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         content = excluded.content,
         is_archived = excluded.is_archived,
         diary_date = excluded.diary_date,
         updated_at = excluded.updated_at`,
        memo.id,
        memo.content,
        memo.isArchived ? 1 : 0,
        memo.diaryDate ?? null,
        memo.createdAt,
        memo.updatedAt
      )

      await db.runAsync('DELETE FROM memo_tags WHERE memo_id = ?', memo.id)
      for (const tag of memo.tags) {
        await db.runAsync('INSERT INTO memo_tags (memo_id, tag) VALUES (?, ?)', memo.id, tag)
      }
    })
  })
}

export async function upsertMemos(memos: Memo[]): Promise<void> {
  if (memos.length === 0) return
  return enqueueDbWrite(async () => {
    const db = await getDatabase()

    await withTransaction(db, async () => {
      for (const memo of memos) {
        await db.runAsync(
          `INSERT INTO memos (id, content, is_archived, diary_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             content = excluded.content,
             is_archived = excluded.is_archived,
             diary_date = excluded.diary_date,
             updated_at = excluded.updated_at`,
          memo.id,
          memo.content,
          memo.isArchived ? 1 : 0,
          memo.diaryDate ?? null,
          memo.createdAt,
          memo.updatedAt
        )

        await db.runAsync('DELETE FROM memo_tags WHERE memo_id = ?', memo.id)
        for (const tag of memo.tags) {
          await db.runAsync('INSERT INTO memo_tags (memo_id, tag) VALUES (?, ?)', memo.id, tag)
        }
      }
    })
  })
}

export async function getMemo(id: string): Promise<MemoWithResources | null> {
  const db = await getDatabase()

  const row = await db.getFirstAsync<any>('SELECT * FROM memos WHERE id = ?', id)
  if (!row) return null

  return rowToMemoWithResources(db, row)
}

export async function listMemos(query?: LocalMemoQuery): Promise<Memo[]> {
  const db = await getDatabase()
  const page = query?.page ?? 1
  const pageSize = query?.pageSize ?? 20
  const offset = (page - 1) * pageSize

  const conditions: string[] = []
  const params: any[] = []

  if (query?.archived !== undefined) {
    conditions.push('m.is_archived = ?')
    params.push(query.archived ? 1 : 0)
  }
  if (query?.diaryDate) {
    conditions.push('m.diary_date = ?')
    params.push(query.diaryDate)
  }
  if (query?.tag) {
    conditions.push('EXISTS (SELECT 1 FROM memo_tags mt WHERE mt.memo_id = m.id AND mt.tag = ?)')
    params.push(query.tag)
  }

  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''

  const rows = await db.getAllAsync<any>(
    `SELECT m.* FROM memos m${where} ORDER BY m.created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    offset
  )

  return Promise.all(rows.map(row => rowToMemo(db, row)))
}

export async function searchMemos(query: LocalMemoSearchQuery): Promise<Memo[]> {
  const db = await getDatabase()
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 20
  const offset = (page - 1) * pageSize

  const conditions: string[] = []
  const params: any[] = []

  if (query.query) {
    conditions.push('m.content LIKE ?')
    params.push(`%${query.query}%`)
  }
  if (query.tags && query.tags.length > 0) {
    const placeholders = query.tags.map(() => '?').join(', ')
    conditions.push(
      `EXISTS (SELECT 1 FROM memo_tags mt WHERE mt.memo_id = m.id AND mt.tag IN (${placeholders}))`
    )
    params.push(...query.tags)
  }
  if (query.startDate !== undefined) {
    conditions.push('m.created_at >= ?')
    params.push(query.startDate)
  }
  if (query.endDate !== undefined) {
    conditions.push('m.created_at <= ?')
    params.push(query.endDate)
  }
  if (query.isArchived !== undefined) {
    conditions.push('m.is_archived = ?')
    params.push(query.isArchived ? 1 : 0)
  }

  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''

  const rows = await db.getAllAsync<any>(
    `SELECT m.* FROM memos m${where} ORDER BY m.created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    offset
  )

  return Promise.all(rows.map(row => rowToMemo(db, row)))
}

export async function deleteMemo(id: string): Promise<void> {
  const db = await getDatabase()
  await db.runAsync('DELETE FROM memos WHERE id = ?', id)
}

// ─── Diaries ───

export interface LocalDiaryQuery {
  page?: number
  pageSize?: number
  startDate?: string
  endDate?: string
}

export async function upsertDiary(diary: Diary): Promise<void> {
  const db = await getDatabase()

  await db.runAsync(
    `INSERT INTO diaries (
      date, summary, mood_key, mood_score,
      generation_source, auto_generation_locked, generated_from_memo_ids,
      last_auto_generated_at, created_at, updated_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       summary = excluded.summary,
       mood_key = excluded.mood_key,
       mood_score = excluded.mood_score,
       generation_source = excluded.generation_source,
       auto_generation_locked = excluded.auto_generation_locked,
       generated_from_memo_ids = excluded.generated_from_memo_ids,
       last_auto_generated_at = excluded.last_auto_generated_at,
       updated_at = excluded.updated_at`,
    diary.date,
    diary.summary,
    diary.moodKey,
    diary.moodScore,
    diary.generationSource,
    diary.autoGenerationLocked ? 1 : 0,
    JSON.stringify(diary.generatedFromMemoIds ?? []),
    diary.lastAutoGeneratedAt ?? null,
    diary.createdAt,
    diary.updatedAt
  )
}

export async function upsertDiaries(diaries: Diary[]): Promise<void> {
  if (diaries.length === 0) return
  return enqueueDbWrite(async () => {
    const db = await getDatabase()

    await withTransaction(db, async () => {
      for (const diary of diaries) {
        await db.runAsync(
          `INSERT INTO diaries (
            date, summary, mood_key, mood_score,
            generation_source, auto_generation_locked, generated_from_memo_ids,
            last_auto_generated_at, created_at, updated_at
          )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET
           summary = excluded.summary,
           mood_key = excluded.mood_key,
           mood_score = excluded.mood_score,
           generation_source = excluded.generation_source,
           auto_generation_locked = excluded.auto_generation_locked,
           generated_from_memo_ids = excluded.generated_from_memo_ids,
           last_auto_generated_at = excluded.last_auto_generated_at,
           updated_at = excluded.updated_at`,
          diary.date,
          diary.summary,
          diary.moodKey,
          diary.moodScore,
          diary.generationSource,
          diary.autoGenerationLocked ? 1 : 0,
          JSON.stringify(diary.generatedFromMemoIds ?? []),
          diary.lastAutoGeneratedAt ?? null,
          diary.createdAt,
          diary.updatedAt
        )
      }
    })
  })
}

export async function getDiary(date: string): Promise<Diary | null> {
  const db = await getDatabase()

  const row = await db.getFirstAsync<any>('SELECT * FROM diaries WHERE date = ?', date)
  if (!row) return null

  return rowToDiary(row)
}

export async function getDiaryWithMemos(date: string): Promise<DiaryWithMemos | null> {
  const db = await getDatabase()

  const row = await db.getFirstAsync<any>('SELECT * FROM diaries WHERE date = ?', date)
  if (!row) return null

  const diary = rowToDiary(row)
  const memoRows = await db.getAllAsync<any>(
    'SELECT * FROM memos WHERE diary_date = ? ORDER BY created_at ASC',
    date
  )

  const memos: MemoWithResources[] = await Promise.all(
    memoRows.map(mRow => rowToMemoWithResources(db, mRow))
  )

  return { ...diary, memos }
}

export async function listDiaries(query?: LocalDiaryQuery): Promise<Diary[]> {
  const db = await getDatabase()
  const page = query?.page ?? 1
  const pageSize = query?.pageSize ?? 20
  const offset = (page - 1) * pageSize

  const conditions: string[] = []
  const params: any[] = []

  if (query?.startDate) {
    conditions.push('date >= ?')
    params.push(query.startDate)
  }
  if (query?.endDate) {
    conditions.push('date <= ?')
    params.push(query.endDate)
  }

  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''

  const rows = await db.getAllAsync<any>(
    `SELECT * FROM diaries${where} ORDER BY date DESC LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    offset
  )

  return rows.map(rowToDiary)
}

export async function deleteDiary(date: string): Promise<void> {
  const db = await getDatabase()
  await db.runAsync('DELETE FROM diaries WHERE date = ?', date)
}

// ─── Resources ───

export async function upsertResource(resource: Resource): Promise<void> {
  const db = await getDatabase()

  await db.runAsync(
    `INSERT INTO resources (id, memo_id, filename, resource_type, mime_type, file_size, storage_type, url, thumbnail_url, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       memo_id = excluded.memo_id,
       filename = excluded.filename,
       resource_type = excluded.resource_type,
       mime_type = excluded.mime_type,
       file_size = excluded.file_size,
       storage_type = excluded.storage_type,
       url = excluded.url,
       thumbnail_url = excluded.thumbnail_url,
       metadata = excluded.metadata`,
    resource.id,
    resource.memoId ?? null,
    resource.filename,
    resource.resourceType,
    resource.mimeType,
    resource.fileSize ?? 0,
    resource.storageType ?? 'local',
    resource.url,
    resource.thumbnailUrl ?? null,
    JSON.stringify(resource.metadata),
    resource.createdAt
  )
}

export async function upsertResources(resources: Resource[]): Promise<void> {
  if (resources.length === 0) return
  return enqueueDbWrite(async () => {
    const db = await getDatabase()

    await withTransaction(db, async () => {
      for (const resource of resources) {
        await db.runAsync(
          `INSERT INTO resources (id, memo_id, filename, resource_type, mime_type, file_size, storage_type, url, thumbnail_url, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           memo_id = excluded.memo_id,
           filename = excluded.filename,
           resource_type = excluded.resource_type,
           mime_type = excluded.mime_type,
           file_size = excluded.file_size,
           storage_type = excluded.storage_type,
           url = excluded.url,
           thumbnail_url = excluded.thumbnail_url,
           metadata = excluded.metadata`,
          resource.id,
          resource.memoId ?? null,
          resource.filename,
          resource.resourceType,
          resource.mimeType,
          resource.fileSize ?? 0,
          resource.storageType ?? 'local',
          resource.url,
          resource.thumbnailUrl ?? null,
          JSON.stringify(resource.metadata),
          resource.createdAt
        )
      }
    })
  })
}

export async function getResourcesByMemoId(memoId: string): Promise<Resource[]> {
  const db = await getDatabase()

  const rows = await db.getAllAsync<any>(
    'SELECT * FROM resources WHERE memo_id = ? ORDER BY created_at ASC',
    memoId
  )

  return rows.map(rowToResource)
}

export async function deleteResource(id: string): Promise<void> {
  const db = await getDatabase()
  await db.runAsync('DELETE FROM resources WHERE id = ?', id)
}

// ─── Stats ───

export async function upsertDailyStat(
  date: string,
  memoCount: number,
  diaryCount: number,
  moodScore: number | null
): Promise<void> {
  const db = await getDatabase()
  await db.runAsync(
    `INSERT INTO stats_daily (date, memo_count, diary_count, mood_score)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       memo_count = excluded.memo_count,
       diary_count = excluded.diary_count,
       mood_score = excluded.mood_score`,
    date,
    memoCount,
    diaryCount,
    moodScore
  )
}

export async function getDailyStats(
  startDate: string,
  endDate: string
): Promise<{ date: string; memoCount: number; diaryCount: number; moodScore: number | null }[]> {
  const db = await getDatabase()

  const rows = await db.getAllAsync<any>(
    'SELECT * FROM stats_daily WHERE date >= ? AND date <= ? ORDER BY date ASC',
    startDate,
    endDate
  )

  return rows.map(row => ({
    date: row.date,
    memoCount: row.memo_count,
    diaryCount: row.diary_count,
    moodScore: row.mood_score,
  }))
}

// ─── Row mappers ───

async function rowToMemo(db: any, row: any): Promise<Memo> {
  const tagRows = (await db.getAllAsync('SELECT tag FROM memo_tags WHERE memo_id = ?', row.id)) as {
    tag: string
  }[]
  return {
    id: row.id,
    content: row.content ?? '',
    tags: tagRows.map((t: { tag: string }) => t.tag),
    isArchived: row.is_archived === 1,
    diaryDate: row.diary_date ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function rowToMemoWithResources(db: any, row: any): Promise<MemoWithResources> {
  const memo = await rowToMemo(db, row)
  const resourceRows = (await db.getAllAsync(
    'SELECT * FROM resources WHERE memo_id = ? ORDER BY created_at ASC',
    row.id
  )) as any[]
  return {
    ...memo,
    resources: resourceRows.map(rowToResource),
  }
}

function rowToDiary(row: any): Diary {
  return {
    date: row.date,
    summary: row.summary ?? '',
    moodKey: row.mood_key,
    moodScore: row.mood_score,
    generationSource: row.generation_source ?? 'manual',
    autoGenerationLocked: Boolean(row.auto_generation_locked),
    generatedFromMemoIds: row.generated_from_memo_ids
      ? JSON.parse(row.generated_from_memo_ids)
      : [],
    lastAutoGeneratedAt: row.last_auto_generated_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToResource(row: any): Resource {
  let metadata: ResourceMetadata = {}
  if (row.metadata) {
    try {
      metadata = JSON.parse(row.metadata)
    } catch {
      // Ignore corrupt metadata
    }
  }

  return {
    id: row.id,
    memoId: row.memo_id ?? null,
    filename: row.filename,
    resourceType: row.resource_type,
    mimeType: row.mime_type,
    fileSize: row.file_size ?? 0,
    storageType: row.storage_type ?? 'local',
    url: row.url,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    metadata,
    createdAt: row.created_at,
  }
}

// ─── Sync Cursors ───

export async function getSyncCursors(): Promise<Record<string, number>> {
  const db = await getDatabase()
  const rows = await db.getAllAsync<{ entity_type: string; last_sync_at: number }>(
    'SELECT entity_type, last_sync_at FROM sync_cursors'
  )
  const cursors: Record<string, number> = {}
  for (const row of rows) {
    cursors[row.entity_type] = row.last_sync_at
  }
  return cursors
}

export async function upsertSyncCursor(entityType: string, lastSyncAt: number): Promise<void> {
  const db = await getDatabase()
  await db.runAsync(
    `INSERT OR REPLACE INTO sync_cursors (entity_type, last_sync_at) VALUES (?, ?)`,
    entityType,
    lastSyncAt
  )
}

// ─── Apply Pulled Changes ───

export async function applyPulledMemos(
  updated: Record<string, unknown>[],
  deletedIds: string[]
): Promise<void> {
  return enqueueDbWrite(async () => {
    const db = await getDatabase()
    for (const id of deletedIds) {
      await db.runAsync('DELETE FROM memos WHERE id = ?', id)
      await db.runAsync('DELETE FROM memo_tags WHERE memo_id = ?', id)
    }
    for (const item of updated) {
      const id = item.id as string
      const content = (item.content as string) ?? ''
      const tags = (item.tags as string[]) ?? []
      const isArchived = (item.isArchived as boolean) ? 1 : 0
      const diaryDate = (item.diaryDate as string) ?? null
      const createdAt = (item.createdAt as number) ?? 0
      const updatedAt = (item.updatedAt as number) ?? 0

      await db.runAsync(
        `INSERT OR REPLACE INTO memos (id, content, is_archived, diary_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        id,
        content,
        isArchived,
        diaryDate,
        createdAt,
        updatedAt
      )
      await db.runAsync('DELETE FROM memo_tags WHERE memo_id = ?', id)
      for (const tag of tags) {
        await db.runAsync('INSERT OR IGNORE INTO memo_tags (memo_id, tag) VALUES (?, ?)', id, tag)
      }
    }
  })
}

export async function applyPulledDiaries(
  updated: Record<string, unknown>[],
  deletedIds: string[]
): Promise<void> {
  return enqueueDbWrite(async () => {
    const db = await getDatabase()
    for (const dateStr of deletedIds) {
      await db.runAsync('DELETE FROM diaries WHERE date = ?', dateStr)
    }
    for (const item of updated) {
      const date = item.date as string
      const summary = (item.summary as string) ?? ''
      const moodKey = (item.moodKey as string) ?? 'neutral'
      const moodScore = (item.moodScore as number) ?? 5
      const createdAt = (item.createdAt as number) ?? 0
      const updatedAt = (item.updatedAt as number) ?? 0

      await db.runAsync(
        `INSERT OR REPLACE INTO diaries (
          date, summary, mood_key, mood_score,
          generation_source, auto_generation_locked, generated_from_memo_ids,
          last_auto_generated_at, created_at, updated_at
        )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        date,
        summary,
        moodKey,
        moodScore,
        (item.generationSource as string) ?? 'manual',
        (item.autoGenerationLocked as boolean) ? 1 : 0,
        JSON.stringify((item.generatedFromMemoIds as string[]) ?? []),
        (item.lastAutoGeneratedAt as number) ?? null,
        createdAt,
        updatedAt
      )
    }
  })
}

export async function applyPulledResources(
  updated: Record<string, unknown>[],
  deletedIds: string[]
): Promise<void> {
  return enqueueDbWrite(async () => {
    const db = await getDatabase()
    for (const id of deletedIds) {
      await db.runAsync('DELETE FROM resources WHERE id = ?', id)
    }
    for (const item of updated) {
      const id = item.id as string
      const memoId = (item.memoId as string) ?? null
      const filename = (item.filename as string) ?? ''
      const resourceType = (item.resourceType as string) ?? 'image'
      const mimeType = (item.mimeType as string) ?? ''
      const fileSize = (item.fileSize as number) ?? 0
      const storageType = (item.storageType as string) ?? 'local'
      const createdAt = (item.createdAt as number) ?? 0

      const insertSql = `INSERT OR REPLACE INTO resources (id, memo_id, filename, resource_type, mime_type, file_size, storage_type, url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      try {
        await db.runAsync(
          insertSql,
          id,
          memoId,
          filename,
          resourceType,
          mimeType,
          fileSize,
          storageType,
          `/api/resources/${id}/download`,
          createdAt
        )
      } catch (e: any) {
        if (e?.message?.includes('FOREIGN KEY')) {
          // memo was deleted — skip this orphaned resource
          console.warn(
            '[applyPulledResources] skipping orphaned resource',
            id,
            '(memoId',
            memoId,
            'not found locally)'
          )
        } else {
          throw e
        }
      }
    }
  })
}
