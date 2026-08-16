import { z } from 'zod/v3'
import { memoryApi } from '@mosaic/api/node'
import { jsonResult } from '../result.js'
import type { McpToolDefinition } from './types.js'

// ── Get Memory Stats ─────────────────────────────────
export async function handleGetMemoryStats() {
  const result = await memoryApi.getStats()
  return jsonResult(result)
}

// ── Get Memory Activity ──────────────────────────────
export const getMemoryActivitySchema = {
  limit: z.number().max(200).optional().describe('Number of activity entries to return'),
}

export async function handleGetMemoryActivity(
  args: z.infer<ReturnType<typeof z.object<typeof getMemoryActivitySchema>>>
) {
  const result = await memoryApi.getActivity(args.limit ?? 20)
  return jsonResult(result)
}

// ── Get Memory Context ───────────────────────────────
export const getMemoryContextSchema = {
  memoId: z.string().describe('Memo ID to get context for'),
  botId: z.string().describe('Bot ID to get context for'),
  limit: z.number().max(50).optional().describe('Maximum number of context items'),
}

export async function handleGetMemoryContext(
  args: z.infer<ReturnType<typeof z.object<typeof getMemoryContextSchema>>>
) {
  const result = await memoryApi.getContext(args.memoId, args.botId, args.limit)
  return jsonResult(result)
}

// ── Get Memo Contexts ────────────────────────────────
export const getMemoContextsSchema = {
  memoId: z.string().describe('Memo ID to get contexts for'),
  limit: z.number().max(50).optional().describe('Maximum number of context items per bot'),
}

export async function handleGetMemoContexts(
  args: z.infer<ReturnType<typeof z.object<typeof getMemoContextsSchema>>>
) {
  const result = await memoryApi.getMemoContexts(args.memoId, args.limit)
  return jsonResult(result)
}

export const memoryTools: McpToolDefinition[] = [
  {
    name: 'memory_stats',
    title: 'Get Memory Stats',
    description: 'Get memory system statistics (total/indexed memos).',
    handler: () => handleGetMemoryStats(),
  },
  {
    name: 'memory_activity',
    title: 'Get Memory Activity',
    description: 'Get recent memory retrieval activity.',
    inputSchema: getMemoryActivitySchema,
    handler: args => handleGetMemoryActivity(args as Parameters<typeof handleGetMemoryActivity>[0]),
  },
  {
    name: 'memory_context',
    title: 'Get Memory Context',
    description:
      'Get memory context for a memo and bot pair, showing relevant past memos (debugging aid).',
    inputSchema: getMemoryContextSchema,
    handler: args => handleGetMemoryContext(args as Parameters<typeof handleGetMemoryContext>[0]),
  },
  {
    name: 'memory_memo_contexts',
    title: 'Get Memo Contexts',
    description: 'Get memory contexts for a memo across all bots.',
    inputSchema: getMemoContextsSchema,
    handler: args => handleGetMemoContexts(args as Parameters<typeof handleGetMemoContexts>[0]),
  },
]
