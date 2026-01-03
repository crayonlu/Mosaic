import type { Memo, MemoRow, MemoWithResources, Resource } from '@/types'

// ============================================================================
// Time Utilities (using dayjs)
// ============================================================================

import dayjs from 'dayjs'

// ============================================================================
// UUID Generator (Simple implementation without external dependency)
// ============================================================================

/**
 * Generate a UUID v4-like ID without requiring external package
 * This is a simplified version that's sufficient for our use case
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Get current timestamp in milliseconds
 */
export function getCurrentTimestamp(): number {
  return dayjs().valueOf()
}

/**
 * Format a timestamp to ISO string
 */
export function formatTimestamp(timestamp: number): string {
  return dayjs(timestamp).toISOString()
}

/**
 * Parse an ISO string to timestamp
 */
export function parseTimestamp(isoString: string): number {
  return dayjs(isoString).valueOf()
}

/**
 * Format a timestamp to date string (YYYY-MM-DD)
 */
export function formatDate(timestamp: number): string {
  return dayjs(timestamp).format('YYYY-MM-DD')
}

// ============================================================================
// JSON Serialization for SQLite
// ============================================================================

/**
 * Serialize an array to JSON string for SQLite storage
 */
export function serializeArray<T>(array: T[]): string {
  return JSON.stringify(array)
}

/**
 * Deserialize a JSON string from SQLite to array
 */
export function deserializeArray<T>(jsonString: string): T[] {
  try {
    return JSON.parse(jsonString)
  } catch (error) {
    console.error('Failed to deserialize array:', error)
    return []
  }
}

// ============================================================================
// Data Transformation Helpers
// ============================================================================

/**
 * Transform MemoRow from database to Memo
 */
export function memoRowToMemo(row: MemoRow): Memo {
  return {
    id: row.id,
    content: row.content,
    contentFormat: (row.contentFormat as 'plain' | 'html') || 'plain',
    tags: deserializeArray<string>(row.tags),
    isArchived: row.isArchived === 1,
    isDeleted: row.isDeleted === 1,
    diaryDate: row.diaryDate || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/**
 * Transform Memo with resources from database to MemoWithResources
 */
export function memoWithResourcesFromRows(
  memoRow: MemoRow,
  resources: Resource[]
): MemoWithResources {
  return {
    ...memoRowToMemo(memoRow),
    resources,
  }
}

/**
 * Build IN clause for SQL queries
 */
export function buildInClause(items: (string | number)[]): string {
  if (items.length === 0) {
    return 'NULL'
  }
  return items.map(() => '?').join(',')
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function isValidDateString(dateString: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateString) && dayjs(dateString).isValid()
}

// ============================================================================
// Database Row Builders
// ============================================================================

/**
 * Build a memo row for insertion
 */
export function buildMemoRow(memo: Partial<Memo> & { id?: string }): Partial<MemoRow> {
  const now = getCurrentTimestamp()
  return {
    id: memo.id || generateId(),
    content: memo.content || '',
    contentFormat: memo.contentFormat || 'html', // Default to 'html' for new memos with rich text editor
    tags: serializeArray(memo.tags || []),
    isArchived: memo.isArchived !== undefined ? (memo.isArchived ? 1 : 0) : 0,
    isDeleted: memo.isDeleted !== undefined ? (memo.isDeleted ? 1 : 0) : 0,
    diaryDate: memo.diaryDate || null,
    createdAt: memo.createdAt || now,
    updatedAt: memo.updatedAt || now,
  }
}

/**
 * Build a resource row for insertion
 */
export function buildResourceRow(resource: Partial<Resource> & { id?: string }): Partial<Resource> {
  const now = getCurrentTimestamp()
  return {
    id: resource.id || generateId(),
    memoId: resource.memoId || '',
    filename: resource.filename || '',
    resourceType: resource.resourceType || 'file',
    mimeType: resource.mimeType || '',
    size: resource.size || 0,
    createdAt: resource.createdAt || now,
  }
}
