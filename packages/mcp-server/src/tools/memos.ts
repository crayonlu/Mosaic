import { z } from 'zod/v3'
import { memosApi } from '@mosaic/api/node'
import { jsonResult, textResult } from '../result.js'
import type { McpToolDefinition } from './types.js'

// ── Search Memos ─────────────────────────────────────
export const searchMemosSchema = {
  query: z.string().describe('Full-text search query'),
  tags: z.array(z.string()).optional().describe('Filter by tags'),
  startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
  isArchived: z.boolean().optional().describe('Filter by archived status'),
  page: z.number().optional().describe('Page number (1-based)'),
  pageSize: z.number().max(200).optional().describe('Items per page (max 200)'),
}

export async function handleSearchMemos(
  args: z.infer<ReturnType<typeof z.object<typeof searchMemosSchema>>>
) {
  const result = await memosApi.search(args)
  return jsonResult(result)
}

// ── List Memos ───────────────────────────────────────
export const listMemosSchema = {
  page: z.number().optional().describe('Page number (1-based)'),
  pageSize: z.number().max(200).optional().describe('Items per page (max 200)'),
  archived: z.boolean().optional().describe('Filter by archived status'),
  diaryDate: z.string().optional().describe('Filter by diary date (YYYY-MM-DD)'),
}

export async function handleListMemos(
  args: z.infer<ReturnType<typeof z.object<typeof listMemosSchema>>>
) {
  const result = await memosApi.list(args)
  return jsonResult(result)
}

// ── Get Memo ─────────────────────────────────────────
export const getMemosSchema = {
  id: z.string().describe('Memo ID'),
}

export async function handleGetMemo(
  args: z.infer<ReturnType<typeof z.object<typeof getMemosSchema>>>
) {
  const result = await memosApi.get(args.id)
  return jsonResult(result)
}

// ── Get Memo Detail ──────────────────────────────────
export const getMemoDetailSchema = {
  id: z.string().describe('Memo ID'),
}

export async function handleGetMemoDetail(
  args: z.infer<ReturnType<typeof z.object<typeof getMemoDetailSchema>>>
) {
  const result = await memosApi.getDetail(args.id)
  return jsonResult(result)
}

// ── Get Memos by Date ────────────────────────────────
export const getMemosByDateSchema = {
  date: z.string().describe('Date (YYYY-MM-DD) to list memos created on'),
  archived: z.boolean().optional().describe('Filter by archived status'),
}

export async function handleGetMemosByDate(
  args: z.infer<ReturnType<typeof z.object<typeof getMemosByDateSchema>>>
) {
  const result = await memosApi.getByDate(args.date, {
    archived: args.archived,
  })
  return jsonResult(result)
}

// ── Create Memo ──────────────────────────────────────
export const createMemoSchema = {
  content: z.string().describe('Memo content'),
  tags: z.array(z.string()).optional().describe('Tags for the memo'),
  resourceIds: z.array(z.string()).optional().describe('Resource IDs to attach'),
  aiSummary: z.string().optional().describe('AI summary to set'),
  diaryDate: z.string().optional().describe('Date to link memo to (YYYY-MM-DD)'),
}

export async function handleCreateMemo(
  args: z.infer<ReturnType<typeof z.object<typeof createMemoSchema>>>
) {
  const result = await memosApi.create(args)
  return jsonResult(result)
}

// ── Update Memo ──────────────────────────────────────
export const updateMemoSchema = {
  id: z.string().describe('Memo ID'),
  content: z.string().optional().describe('Updated content'),
  tags: z.array(z.string()).optional().describe('Updated tags'),
  resourceIds: z.array(z.string()).optional().describe('Resource IDs to attach'),
  aiSummary: z.string().nullable().optional().describe('AI summary, or null to clear'),
  diaryDate: z.string().nullable().optional().describe('Link to diary date or null to remove'),
}

export async function handleUpdateMemo(
  args: z.infer<ReturnType<typeof z.object<typeof updateMemoSchema>>>
) {
  const result = await memosApi.update(args.id, {
    content: args.content,
    tags: args.tags,
    resourceIds: args.resourceIds,
    aiSummary: args.aiSummary,
    diaryDate: args.diaryDate,
  })
  return jsonResult(result)
}

// ── Delete Memo ──────────────────────────────────────
export const deleteMemosSchema = {
  id: z.string().describe('Memo ID to delete'),
}

export async function handleDeleteMemo(
  args: z.infer<ReturnType<typeof z.object<typeof deleteMemosSchema>>>
) {
  await memosApi.delete(args.id)
  return textResult(`Memo ${args.id} deleted successfully`)
}

// ── Archive Memo ─────────────────────────────────────
export const archiveMemosSchema = {
  id: z.string().describe('Memo ID to archive'),
  diaryDate: z.string().optional().describe('Diary date to archive into (YYYY-MM-DD)'),
}

export async function handleArchiveMemo(
  args: z.infer<ReturnType<typeof z.object<typeof archiveMemosSchema>>>
) {
  await memosApi.archive(args.id, args.diaryDate)
  return textResult(
    `Memo ${args.id} archived successfully${args.diaryDate ? ` into ${args.diaryDate}` : ''}`
  )
}

// ── Unarchive Memo ───────────────────────────────────
export const unarchiveMemoSchema = {
  id: z.string().describe('Memo ID to unarchive'),
}

export async function handleUnarchiveMemo(
  args: z.infer<ReturnType<typeof z.object<typeof unarchiveMemoSchema>>>
) {
  await memosApi.unarchive(args.id)
  return textResult(`Memo ${args.id} unarchived successfully`)
}

// ── Get Memo Tags ────────────────────────────────────
export async function handleGetTags() {
  const result = await memosApi.getAllTags()
  return jsonResult(result)
}

// ── Clip to Memo ─────────────────────────────────────
export const clipMemosSchema = {
  clipType: z.enum(['url', 'text', 'image']).describe('Type of content to clip'),
  url: z.string().optional().describe('URL to clip (for url type)'),
  content: z.string().optional().describe('Text content to clip (for text type)'),
  resourceId: z.string().optional().describe('Resource ID to clip (for image type)'),
  userNote: z.string().optional().describe('Optional user note'),
}

export async function handleClipToMemo(
  args: z.infer<ReturnType<typeof z.object<typeof clipMemosSchema>>>
) {
  const result = await memosApi.clip(args)
  return jsonResult(result)
}

// ── Get Memo Revisions ───────────────────────────────
export const getMemoRevisionsSchema = {
  memoId: z.string().describe('Memo ID to get revision history for'),
}

export async function handleGetMemoRevisions(
  args: z.infer<ReturnType<typeof z.object<typeof getMemoRevisionsSchema>>>
) {
  const result = await memosApi.getRevisions(args.memoId)
  return jsonResult(result)
}

// ── Delete Memo Revision ─────────────────────────────
export const deleteMemoRevisionSchema = {
  memoId: z.string().describe('Memo ID'),
  revisionId: z.string().describe('Revision ID to delete'),
}

export async function handleDeleteMemoRevision(
  args: z.infer<ReturnType<typeof z.object<typeof deleteMemoRevisionSchema>>>
) {
  await memosApi.deleteRevision(args.memoId, args.revisionId)
  return textResult(`Revision ${args.revisionId} deleted successfully`)
}

export const memosTools: McpToolDefinition[] = [
  {
    name: 'memos_search',
    title: 'Search Memos',
    description:
      'Search memos by full-text query, tags, and date range. Supports semantic search when configured.',
    inputSchema: searchMemosSchema,
    handler: args => handleSearchMemos(args as Parameters<typeof handleSearchMemos>[0]),
  },
  {
    name: 'memos_list',
    title: 'List Memos',
    description:
      'List memos with pagination and optional filters for archive status and diary date.',
    inputSchema: listMemosSchema,
    handler: args => handleListMemos(args as Parameters<typeof handleListMemos>[0]),
  },
  {
    name: 'memos_get',
    title: 'Get Memo',
    description: 'Get a single memo by its ID.',
    inputSchema: getMemosSchema,
    handler: args => handleGetMemo(args as Parameters<typeof handleGetMemo>[0]),
  },
  {
    name: 'memos_detail',
    title: 'Get Memo Detail',
    description:
      'Get a memo with its full detail: content, resources, revision history, and bot replies.',
    inputSchema: getMemoDetailSchema,
    handler: args => handleGetMemoDetail(args as Parameters<typeof handleGetMemoDetail>[0]),
  },
  {
    name: 'memos_by_date',
    title: 'Get Memos by Date',
    description:
      'List memos created on a specific date (YYYY-MM-DD, interpreted in the server timezone).',
    inputSchema: getMemosByDateSchema,
    handler: args => handleGetMemosByDate(args as Parameters<typeof handleGetMemosByDate>[0]),
  },
  {
    name: 'memos_create',
    title: 'Create Memo',
    description:
      'Create a new memo with content, tags, optional attached resources, and optional diary date.',
    inputSchema: createMemoSchema,
    handler: args => handleCreateMemo(args as Parameters<typeof handleCreateMemo>[0]),
  },
  {
    name: 'memos_update',
    title: 'Update Memo',
    description:
      'Update an existing memo content, tags, resources, AI summary, or diary date. Pass null to clear a field.',
    inputSchema: updateMemoSchema,
    handler: args => handleUpdateMemo(args as Parameters<typeof handleUpdateMemo>[0]),
  },
  {
    name: 'memos_delete',
    title: 'Delete Memo',
    description: 'Permanently delete a memo by its ID. This cannot be undone.',
    inputSchema: deleteMemosSchema,
    handler: args => handleDeleteMemo(args as Parameters<typeof handleDeleteMemo>[0]),
  },
  {
    name: 'memos_archive',
    title: 'Archive Memo',
    description: 'Archive a memo, optionally linking it to a diary date.',
    inputSchema: archiveMemosSchema,
    handler: args => handleArchiveMemo(args as Parameters<typeof handleArchiveMemo>[0]),
  },
  {
    name: 'memos_unarchive',
    title: 'Unarchive Memo',
    description: 'Restore an archived memo.',
    inputSchema: unarchiveMemoSchema,
    handler: args => handleUnarchiveMemo(args as Parameters<typeof handleUnarchiveMemo>[0]),
  },
  {
    name: 'memos_tags',
    title: 'Get Memo Tags',
    description: 'List all tags used across memos with their usage counts.',
    handler: () => handleGetTags(),
  },
  {
    name: 'memos_clip',
    title: 'Clip to Memo',
    description:
      'Clip a URL, text, or image to create a new memo with AI-generated summary and tags.',
    inputSchema: clipMemosSchema,
    handler: args => handleClipToMemo(args as Parameters<typeof handleClipToMemo>[0]),
  },
  {
    name: 'memos_revisions',
    title: 'Get Memo Revisions',
    description: 'Get the full revision history of a memo, ordered oldest first.',
    inputSchema: getMemoRevisionsSchema,
    handler: args => handleGetMemoRevisions(args as Parameters<typeof handleGetMemoRevisions>[0]),
  },
  {
    name: 'memos_delete_revision',
    title: 'Delete Memo Revision',
    description:
      'Delete a specific revision of a memo. The last remaining revision cannot be deleted; delete the memo instead.',
    inputSchema: deleteMemoRevisionSchema,
    handler: args =>
      handleDeleteMemoRevision(args as Parameters<typeof handleDeleteMemoRevision>[0]),
  },
]
