import { execute, queryAll, queryFirst } from '@/lib/database'
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
      contentFormat: (row.contentFormat as 'plain' | 'html') || 'plain',
      tags: row.tags ? JSON.parse(row.tags) : [],
      isArchived: row.isArchived === 1,
      isDeleted: row.isDeleted === 1,
      diaryDate: row.diaryDate || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  /**
   * Generate unique ID for memo
   */
  private generateId(): string {
    return `memo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get current timestamp in milliseconds
   */
  private getCurrentTimestamp(): number {
    return Date.now()
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  /**
   * Create a new memo
   */
  async createMemo(params: Omit<CreateMemoRequest, 'resourceFilenames'> & {
    resourceFilenames?: string[]
  }): Promise<Memo> {
    const id = this.generateId()
    const now = this.getCurrentTimestamp()

    const contentFormat = this.detectContentFormat(params.content)
    const tagsJson = JSON.stringify(params.tags || [])

    await execute(
      `INSERT INTO memos (id, content, contentFormat, tags, is_archived, is_deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, params.content, contentFormat, tagsJson, 0, 0, now, now]
    )

    // Link resources if provided
    if (params.resourceFilenames && params.resourceFilenames.length > 0) {
      for (const filename of params.resourceFilenames) {
        await execute(
          `UPDATE resources SET memo_id = ? WHERE filename = ? AND memo_id IS NULL`,
          [id, filename]
        )
      }
    }

    const memo = await this.getMemo(id)
    if (!memo) {
      throw new Error('Failed to create memo')
    }
    return memo
  }

  /**
   * Get memo by id with resources
   */
  async getMemo(id: string): Promise<MemoWithResources | null> {
    const row = await queryFirst<MemoRow>(
      `SELECT * FROM memos WHERE id = ?`,
      [id]
    )

    if (!row) {
      return null
    }

    const memo = this.rowToMemo(row)
    const resources = await this.getMemoResources(id)

    return {
      ...memo,
      resources,
    }
  }

  /**
   * Get memos by date
   */
  async getMemosByDate(date: string): Promise<MemoWithResources[]> {
    const rows = await queryAll<MemoRow>(
      `SELECT * FROM memos 
       WHERE date(created_at / 1000, 'unixepoch', 'localtime') = ?
       AND is_archived = 0 AND is_deleted = 0
       ORDER BY created_at DESC`,
      [date]
    )

    const memos = rows.map(this.rowToMemo)

    // Fetch resources for all memos
    const memosWithResources = await Promise.all(
      memos.map(async memo => ({
        ...memo,
        resources: await this.getMemoResources(memo.id),
      }))
    )

    return memosWithResources
  }

  /**
   * Get list of memos with filtering
   */
  async listMemos(params: ListMemosRequest = {}): Promise<MemoWithResources[]> {
    const {
      page = 1,
      pageSize = 20,
      isArchived = false,
      isDeleted = false,
      diaryDate,
    } = params

    const offset = (page - 1) * pageSize

    let query = `SELECT * FROM memos WHERE 1=1`
    const queryParams: any[] = []

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

    const rows = await queryAll<MemoRow>(query, queryParams)
    const memos = rows.map(this.rowToMemo)

    // Fetch resources for all memos
    const memosWithResources = await Promise.all(
      memos.map(async memo => ({
        ...memo,
        resources: await this.getMemoResources(memo.id),
      }))
    )

    return memosWithResources
  }

  /**
   * Update memo
   */
  async updateMemo(params: UpdateMemoRequest): Promise<MemoWithResources | null> {
    const { id, content, tags, resourceFilenames } = params
    const now = this.getCurrentTimestamp()

    // Build update query dynamically
    const updates: string[] = []
    const queryParams: any[] = []

    if (content !== undefined) {
      const contentFormat = this.detectContentFormat(content)
      updates.push('content = ?, contentFormat = ?')
      queryParams.push(content, contentFormat)
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

    await execute(
      `UPDATE memos SET ${updates.join(', ')} WHERE id = ?`,
      queryParams
    )

    // Update resources if provided
    if (resourceFilenames !== undefined) {
      // Unlink old resources
      await execute(
        `UPDATE resources SET memo_id = NULL WHERE memo_id = ?`,
        [id]
      )

      // Link new resources
      for (const filename of resourceFilenames) {
        await execute(
          `UPDATE resources SET memo_id = ? WHERE filename = ? AND memo_id IS NULL`,
          [id, filename]
        )
      }
    }

    return await this.getMemo(id)
  }

  /**
   * Soft delete memo
   */
  async deleteMemo(id: string): Promise<void> {
    const now = this.getCurrentTimestamp()
    await execute(
      `UPDATE memos SET is_deleted = 1, updated_at = ? WHERE id = ?`,
      [now, id]
    )
  }

  /**
   * Archive or unarchive memo
   */
  async archiveMemo(id: string, archived = true): Promise<void> {
    const now = this.getCurrentTimestamp()
    await execute(
      `UPDATE memos SET is_archived = ?, updated_at = ? WHERE id = ?`,
      [archived ? 1 : 0, now, id]
    )
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
    const queryParams: any[] = []

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

    const rows = await queryAll<MemoRow>(sql, queryParams)
    const memos = rows.map(this.rowToMemo)

    // Fetch resources for all memos
    const memosWithResources = await Promise.all(
      memos.map(async memo => ({
        ...memo,
        resources: await this.getMemoResources(memo.id),
      }))
    )

    return memosWithResources
  }

  /**
   * Get all unique tags
   */
  async getAllTags(): Promise<string[]> {
    const rows = await queryAll<{ tags: string }>(
      `SELECT DISTINCT tags FROM memos WHERE is_deleted = 0 AND tags != '[]'`
    )

    const allTags = rows
      .map(row => (row.tags ? JSON.parse(row.tags) : []))
      .flat()
      .filter((tag, index, self) => self.indexOf(tag) === index)

    return allTags
  }

  // ============================================================================
  // Resource Operations
  // ============================================================================

  /**
   * Get resources for a specific memo
   */
  async getMemoResources(memoId: string): Promise<any[]> {
    const resources = await queryAll<any>(
      `SELECT * FROM resources WHERE memo_id = ? ORDER BY created_at DESC`,
      [memoId]
    )

    return resources.map(resource => ({
      id: resource.id,
      memoId: resource.memoId,
      filename: resource.filename,
      resourceType: resource.resourceType,
      mimeType: resource.mimeType,
      size: resource.size,
      createdAt: resource.createdAt,
    }))
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Detect content format (plain text or HTML)
   */
  private detectContentFormat(content: string): 'plain' | 'html' {
    if (!content || content.trim() === '') {
      return 'plain'
    }

    // Check for HTML tags
    const htmlTagPattern = /<[a-z][\s\S]*>/i
    return htmlTagPattern.test(content) ? 'html' : 'plain'
  }

  /**
   * Get memos count
   */
  async getMemosCount(params: {
    isArchived?: boolean
    isDeleted?: boolean
    diaryDate?: string
  } = {}): Promise<number> {
    const { isArchived = false, isDeleted = false, diaryDate } = params

    let query = `SELECT COUNT(*) as count FROM memos WHERE 1=1`
    const queryParams: any[] = []

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

    const result = await queryFirst<{ count: number }>(query, queryParams)
    return result?.count || 0
  }
}

// Export singleton instance
export const memoService = new MemoService()
