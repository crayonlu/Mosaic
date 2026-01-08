import { QueryError } from '@/lib/database/errors'
import { useDatabaseStore } from '@/lib/database/state-manager'
import { generateTimestampId, getCurrentTimestamp } from '@/lib/utils/time'
import {
  type CreateMemoRequest,
  type ListMemosRequest,
  type Memo,
  type MemoRow,
  type MemoWithResources,
  type SearchMemosRequest,
  type UpdateMemoRequest,
} from '@/types/memo'

/**
 * Memo Service
 * Handles all memo-related database operations
 */

class MemoService {
  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Convert database row to Memo interface
   */
  private rowToMemo(row: MemoRow): Memo {
    return {
      id: row.id,
      content: row.content,
      tags: row.tags ? JSON.parse(row.tags) : [],
      isArchived: row.is_archived === 1,
      isDeleted: row.is_deleted === 1,
      diaryDate: row.diary_date || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  /**
   * Generate unique ID for memo
   */
  private generateId(): string {
    return generateTimestampId('memo_')
  }

  /**
   * Get current timestamp in milliseconds
   */
  private getCurrentTimestamp(): number {
    return getCurrentTimestamp()
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  /**
   * Create a new memo
   */
  async createMemo(
    params: Omit<CreateMemoRequest, 'resourceFilenames'> & {
      resourceFilenames?: string[]
    }
  ): Promise<Memo> {
    const id = this.generateId()
    const now = this.getCurrentTimestamp()

    const tagsJson = JSON.stringify(params.tags || [])

    try {
      await useDatabaseStore.getState().execute(
        `INSERT INTO memos (id, content, tags, is_archived, is_deleted, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, params.content, tagsJson, 0, 0, now, now]
      )

      // Link resources if provided
      if (params.resourceFilenames && params.resourceFilenames.length > 0) {
        for (const filename of params.resourceFilenames) {
          await useDatabaseStore
            .getState()
            .execute(`UPDATE resources SET memo_id = ? WHERE filename = ? AND memo_id IS NULL`, [
              id,
              filename,
            ])
        }
      }

      const memo = await this.getMemo(id)
      if (!memo) {
        throw new QueryError('Failed to create memo', 'INSERT INTO memos', [id])
      }
      return memo
    } catch (error) {
      throw new QueryError(
        `Failed to create memo: ${error instanceof Error ? error.message : String(error)}`,
        'INSERT INTO memos',
        [id],
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get memo by id with resources
   */
  async getMemo(id: string): Promise<MemoWithResources | null> {
    try {
      const row = await useDatabaseStore
        .getState()
        .queryFirst<MemoRow>(`SELECT * FROM memos WHERE id = ?`, [id])

      if (!row) {
        return null
      }

      const memo = this.rowToMemo(row)
      const resources = await this.getMemoResources(id)

      return {
        ...memo,
        resources: resources as any[],
      }
    } catch (error) {
      throw new QueryError(
        `Failed to get memo: ${error instanceof Error ? error.message : String(error)}`,
        'SELECT * FROM memos WHERE id = ?',
        [id],
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get memos by date
   */
  async getMemosByDate(date: string): Promise<MemoWithResources[]> {
    try {
      const rows = await useDatabaseStore.getState().queryAll<MemoRow>(
        `SELECT * FROM memos
         WHERE date(created_at / 1000, 'unixepoch', 'localtime') = ?
         AND is_archived = 0 AND is_deleted = 0
         ORDER BY created_at DESC`,
        [date]
      )

      const memos = rows.map(this.rowToMemo)

      // Fetch resources for all memos
      const memosWithResources = await Promise.all(
        memos.map(async (memo: Memo) => ({
          ...memo,
          resources: await this.getMemoResources(memo.id),
        }))
      )

      return memosWithResources as MemoWithResources[]
    } catch (error) {
      throw new QueryError(
        `Failed to get memos by date: ${error instanceof Error ? error.message : String(error)}`,
        "SELECT * FROM memos WHERE date(created_at / 1000, 'unixepoch', 'localtime') = ?",
        [date],
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get list of memos with filtering
   */
  async listMemos(params: ListMemosRequest = {}): Promise<MemoWithResources[]> {
    const { page = 1, pageSize = 20, isArchived = false, isDeleted = false, diaryDate } = params

    const offset = (page - 1) * pageSize

    let query = `SELECT * FROM memos WHERE 1=1`
    const queryParams: unknown[] = []

    if (isArchived !== undefined) {
      query += ` AND is_archived = ?`
      queryParams.push(isArchived ? 1 : 0)
    }

    if (isDeleted !== undefined) {
      query += ` AND is_deleted = ?`
      queryParams.push(isDeleted ? 1 : 0)
    }

    if (diaryDate) {
      query += ` AND diary_date = ?`
      queryParams.push(diaryDate)
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
    queryParams.push(pageSize, offset)

    try {
      const rows = await useDatabaseStore.getState().queryAll<MemoRow>(query, queryParams)
      const memos = rows.map(this.rowToMemo)

      // Fetch resources for all memos
      const memosWithResources = await Promise.all(
        memos.map(async (memo: Memo) => ({
          ...memo,
          resources: await this.getMemoResources(memo.id),
        }))
      )

      return memosWithResources as MemoWithResources[]
    } catch (error) {
      throw new QueryError(
        `Failed to list memos: ${error instanceof Error ? error.message : String(error)}`,
        query,
        queryParams,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Update memo
   */
  async updateMemo(params: UpdateMemoRequest): Promise<MemoWithResources | null> {
    const { id, content, tags, resourceFilenames } = params
    const now = this.getCurrentTimestamp()

    // Build update query dynamically
    const updates: string[] = []
    const queryParams: unknown[] = []

    if (content !== undefined) {
      updates.push('content = ?')
      queryParams.push(content)
    }

    if (tags !== undefined) {
      updates.push('tags = ?')
      queryParams.push(JSON.stringify(tags))
    }

    if (updates.length === 0) {
      // No fields to update, just return existing memo
      return await this.getMemo(id)
    }

    updates.push('updated_at = ?')
    queryParams.push(now)

    queryParams.push(id)

    const query = `UPDATE memos SET ${updates.join(', ')} WHERE id = ?`

    try {
      await useDatabaseStore.getState().execute(query, queryParams)

      // Update resources if provided
      if (resourceFilenames !== undefined) {
        // Unlink old resources
        await useDatabaseStore
          .getState()
          .execute(`UPDATE resources SET memo_id = NULL WHERE memo_id = ?`, [id])

        // Link new resources
        for (const filename of resourceFilenames) {
          await useDatabaseStore
            .getState()
            .execute(`UPDATE resources SET memo_id = ? WHERE filename = ? AND memo_id IS NULL`, [
              id,
              filename,
            ])
        }
      }

      return await this.getMemo(id)
    } catch (error) {
      throw new QueryError(
        `Failed to update memo: ${error instanceof Error ? error.message : String(error)}`,
        query,
        queryParams,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Soft delete memo
   */
  async deleteMemo(id: string): Promise<void> {
    const now = this.getCurrentTimestamp()

    try {
      await useDatabaseStore
        .getState()
        .execute(`UPDATE memos SET is_deleted = 1, updated_at = ? WHERE id = ?`, [now, id])
    } catch (error) {
      throw new QueryError(
        `Failed to delete memo: ${error instanceof Error ? error.message : String(error)}`,
        'UPDATE memos SET is_deleted = 1, updated_at = ? WHERE id = ?',
        [now, id],
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Archive or unarchive memo
   */
  async archiveMemo(id: string, archived = true): Promise<void> {
    const now = this.getCurrentTimestamp()

    try {
      await useDatabaseStore
        .getState()
        .execute(`UPDATE memos SET is_archived = ?, updated_at = ? WHERE id = ?`, [
          archived ? 1 : 0,
          now,
          id,
        ])
    } catch (error) {
      throw new QueryError(
        `Failed to archive memo: ${error instanceof Error ? error.message : String(error)}`,
        'UPDATE memos SET is_archived = ?, updated_at = ? WHERE id = ?',
        [archived ? 1 : 0, now, id],
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Search memos
   */
  async searchMemos(params: SearchMemosRequest): Promise<MemoWithResources[]> {
    const {
      query: searchText,
      tags,
      startDate,
      endDate,
      isArchived = false,
      page = 1,
      pageSize = 20,
    } = params

    const offset = (page - 1) * pageSize

    let sql = `SELECT * FROM memos WHERE is_deleted = 0`
    const queryParams: unknown[] = []

    // Search in content and tags
    if (searchText) {
      sql += ` AND (content LIKE ? OR tags LIKE ?)`
      const searchPattern = `%${searchText}%`
      queryParams.push(searchPattern, searchPattern)
    }

    // Filter by tags
    if (tags && tags.length > 0) {
      const tagConditions = tags.map(() => 'tags LIKE ?').join(' OR ')
      sql += ` AND (${tagConditions})`
      tags.forEach(tag => {
        queryParams.push(`%"${tag}"%`)
      })
    }

    // Filter by date range
    if (startDate) {
      sql += ` AND date(created_at / 1000, 'unixepoch', 'localtime') >= ?`
      queryParams.push(startDate)
    }

    if (endDate) {
      sql += ` AND date(created_at / 1000, 'unixepoch', 'localtime') <= ?`
      queryParams.push(endDate)
    }

    // Filter by archived status
    sql += ` AND is_archived = ?`
    queryParams.push(isArchived ? 1 : 0)

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
    queryParams.push(pageSize, offset)

    try {
      const rows = await useDatabaseStore.getState().queryAll<MemoRow>(sql, queryParams)
      const memos = rows.map(this.rowToMemo)

      // Fetch resources for all memos
      const memosWithResources = await Promise.all(
        memos.map(async (memo: Memo) => ({
          ...memo,
          resources: await this.getMemoResources(memo.id),
        }))
      )

      return memosWithResources as MemoWithResources[]
    } catch (error) {
      throw new QueryError(
        `Failed to search memos: ${error instanceof Error ? error.message : String(error)}`,
        sql,
        queryParams,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get all unique tags
   */
  async getAllTags(): Promise<string[]> {
    try {
      const rows = await useDatabaseStore.getState().queryAll<{
        tags: string
      }>(`SELECT DISTINCT tags FROM memos WHERE is_deleted = 0 AND tags != '[]'`)

      const allTags = rows
        .map((row: { tags: string }) => (row.tags ? JSON.parse(row.tags) : []))
        .flat()
        .filter((tag: string, index: number, self: string[]) => self.indexOf(tag) === index)

      return allTags
    } catch (error) {
      throw new QueryError(
        `Failed to get all tags: ${error instanceof Error ? error.message : String(error)}`,
        "SELECT DISTINCT tags FROM memos WHERE is_deleted = 0 AND tags != '[]'",
        [],
        error instanceof Error ? error : undefined
      )
    }
  }

  // ============================================================================
  // Resource Operations
  // ============================================================================

  /**
   * Get resources for a specific memo
   */
  async getMemoResources(memoId: string): Promise<unknown[]> {
    try {
      const resources = await useDatabaseStore
        .getState()
        .queryAll<unknown>(`SELECT * FROM resources WHERE memo_id = ? ORDER BY created_at DESC`, [
          memoId,
        ])

      return resources.map((resource: any) => ({
        id: resource.id,
        memoId: resource.memo_id,
        filename: resource.filename,
        resourceType: resource.resource_type,
        mimeType: resource.mime_type,
        size: resource.size,
        createdAt: resource.created_at,
      }))
    } catch (error) {
      throw new QueryError(
        `Failed to get memo resources: ${error instanceof Error ? error.message : String(error)}`,
        'SELECT * FROM resources WHERE memo_id = ? ORDER BY created_at DESC',
        [memoId],
        error instanceof Error ? error : undefined
      )
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Get memos count
   */
  async getMemosCount(
    params: {
      isArchived?: boolean
      isDeleted?: boolean
      diaryDate?: string
    } = {}
  ): Promise<number> {
    const { isArchived = false, isDeleted = false, diaryDate } = params

    let query = `SELECT COUNT(*) as count FROM memos WHERE 1=1`
    const queryParams: unknown[] = []

    if (isArchived !== undefined) {
      query += ` AND is_archived = ?`
      queryParams.push(isArchived ? 1 : 0)
    }

    if (isDeleted !== undefined) {
      query += ` AND is_deleted = ?`
      queryParams.push(isDeleted ? 1 : 0)
    }

    if (diaryDate) {
      query += ` AND diary_date = ?`
      queryParams.push(diaryDate)
    }

    try {
      const result = await useDatabaseStore
        .getState()
        .queryFirst<{ count: number }>(query, queryParams)
      return result?.count || 0
    } catch (error) {
      throw new QueryError(
        `Failed to get memos count: ${error instanceof Error ? error.message : String(error)}`,
        query,
        queryParams,
        error instanceof Error ? error : undefined
      )
    }
  }
}

// Export singleton instance
export const memoService = new MemoService()
