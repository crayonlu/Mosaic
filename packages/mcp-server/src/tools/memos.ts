import { z } from 'zod/v3'
import type { MosaicClient } from '../client.js'
import { jsonResult, textResult } from '../result.js'

// ── Search Memos ─────────────────────────────────────
export const searchMemosSchema = {
  query: z.string().describe('Full-text search query'),
  tags: z.array(z.string()).optional().describe('Filter by tags'),
  startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
  isArchived: z.enum(['true', 'false']).optional().describe('Filter by archived status'),
  page: z.number().optional().describe('Page number (1-based)'),
  pageSize: z.number().optional().describe('Items per page'),
}

export async function handleSearchMemos(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof searchMemosSchema>>>
) {
  const result = await client.searchMemos({
    query: args.query,
    tags: args.tags,
    startDate: args.startDate,
    endDate: args.endDate,
    isArchived: args.isArchived === 'true' ? true : args.isArchived === 'false' ? false : undefined,
    page: args.page,
    pageSize: args.pageSize,
  })
  return jsonResult(result)
}

// ── List Memos ───────────────────────────────────────
export const listMemosSchema = {
  page: z.number().optional().describe('Page number (1-based)'),
  pageSize: z.number().optional().describe('Items per page'),
  archived: z.enum(['true', 'false']).optional().describe('Filter by archived status'),
  diaryDate: z.string().optional().describe('Filter by diary date (YYYY-MM-DD)'),
}

export async function handleListMemos(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof listMemosSchema>>>
) {
  const result = await client.listMemos({
    page: args.page,
    pageSize: args.pageSize,
    archived: args.archived === 'true' ? true : args.archived === 'false' ? false : undefined,
    diaryDate: args.diaryDate,
  })
  return jsonResult(result)
}

// ── Get Memo ─────────────────────────────────────────
export const getMemosSchema = {
  id: z.string().describe('Memo ID'),
}

export async function handleGetMemo(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof getMemosSchema>>>
) {
  const result = await client.getMemo(args.id)
  return jsonResult(result)
}

// ── Create Memo ──────────────────────────────────────
export const createMemoSchema = {
  content: z.string().describe('Memo content'),
  tags: z.array(z.string()).optional().describe('Tags for the memo'),
  diaryDate: z.string().optional().describe('Date to link memo to (YYYY-MM-DD)'),
}

export async function handleCreateMemo(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof createMemoSchema>>>
) {
  const result = await client.createMemo({
    content: args.content,
    tags: args.tags,
    diaryDate: args.diaryDate,
  })
  return jsonResult(result)
}

// ── Update Memo ──────────────────────────────────────
export const updateMemoSchema = {
  id: z.string().describe('Memo ID'),
  content: z.string().optional().describe('Updated content'),
  tags: z.array(z.string()).optional().describe('Updated tags'),
  diaryDate: z.string().nullable().optional().describe('Link to diary date or null to remove'),
}

export async function handleUpdateMemo(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof updateMemoSchema>>>
) {
  const result = await client.updateMemo(args.id, {
    content: args.content,
    tags: args.tags,
    diaryDate: args.diaryDate,
  })
  return jsonResult(result)
}

// ── Delete Memo ──────────────────────────────────────
export const deleteMemosSchema = {
  id: z.string().describe('Memo ID to delete'),
}

export async function handleDeleteMemo(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof deleteMemosSchema>>>
) {
  await client.deleteMemo(args.id)
  return textResult(`Memo ${args.id} deleted successfully`)
}

// ── Archive Memo ─────────────────────────────────────
export const archiveMemosSchema = {
  id: z.string().describe('Memo ID to archive'),
  diaryDate: z.string().optional().describe('Diary date to archive into (YYYY-MM-DD)'),
}

export async function handleArchiveMemo(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof archiveMemosSchema>>>
) {
  await client.archiveMemo(args.id, args.diaryDate)
  return textResult(
    `Memo ${args.id} archived successfully${args.diaryDate ? ` into ${args.diaryDate}` : ''}`
  )
}

// ── Unarchive Memo ───────────────────────────────────
export const unarchiveMemoSchema = {
  id: z.string().describe('Memo ID to unarchive'),
}

export async function handleUnarchiveMemo(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof unarchiveMemoSchema>>>
) {
  await client.unarchiveMemo(args.id)
  return textResult(`Memo ${args.id} unarchived successfully`)
}

// ── Get Memo Tags ────────────────────────────────────
export async function handleGetTags(client: MosaicClient) {
  const result = await client.getAllTags()
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
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof clipMemosSchema>>>
) {
  const result = await client.clipToMemo({
    clipType: args.clipType,
    url: args.url,
    content: args.content,
    resourceId: args.resourceId,
    userNote: args.userNote,
  })
  return jsonResult(result)
}
