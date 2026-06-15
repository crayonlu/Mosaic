import { z } from 'zod/v3'
import type { MosaicClient } from '../client.js'
import { jsonResult } from '../result.js'

// ── Get Memory Stats ─────────────────────────────────
export async function handleGetMemoryStats(client: MosaicClient) {
  const result = await client.getMemoryStats()
  return jsonResult(result)
}

// ── Get Memory Activity ──────────────────────────────
export const getMemoryActivitySchema = {
  limit: z.number().optional().describe('Number of activity entries to return'),
}

export async function handleGetMemoryActivity(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof getMemoryActivitySchema>>>
) {
  const result = await client.getMemoryActivity(args.limit)
  return jsonResult(result)
}

// ── Get Memory Context ───────────────────────────────
export const getMemoryContextSchema = {
  memoId: z.string().describe('Memo ID to get context for'),
  botId: z.string().describe('Bot ID to get context for'),
  limit: z.number().optional().describe('Maximum number of context items'),
}

export async function handleGetMemoryContext(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof getMemoryContextSchema>>>
) {
  const result = await client.getMemoryContext(args.memoId, args.botId, args.limit)
  return jsonResult(result)
}

// ── Get Memo Contexts ────────────────────────────────
export const getMemoContextsSchema = {
  memoId: z.string().describe('Memo ID to get contexts for'),
  limit: z.number().optional().describe('Maximum number of context items per bot'),
}

export async function handleGetMemoContexts(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof getMemoContextsSchema>>>
) {
  const result = await client.getMemoContexts(args.memoId, args.limit)
  return jsonResult(result)
}
