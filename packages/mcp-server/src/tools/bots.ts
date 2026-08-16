import { z } from 'zod/v3'
import { botsApi } from '@mosaic/api/node'
import { jsonResult, textResult } from '../result.js'
import type { McpToolDefinition } from './types.js'

// ── List Bots ────────────────────────────────────────
export async function handleListBots() {
  const result = await botsApi.list()
  return jsonResult(result)
}

// ── Get Bot ──────────────────────────────────────────
export const getBotSchema = {
  id: z.string().describe('Bot ID'),
}

export async function handleGetBot(
  args: z.infer<ReturnType<typeof z.object<typeof getBotSchema>>>
) {
  const result = await botsApi.get(args.id)
  return jsonResult(result)
}

// ── Create Bot ───────────────────────────────────────
export const createBotSchema = {
  name: z.string().describe('Bot name'),
  description: z.string().optional().describe('Bot description (default empty)'),
  tags: z.array(z.string()).optional().describe('Tags for the bot'),
  autoReply: z.boolean().optional().describe('Auto-reply to matching memos (default true)'),
  model: z.string().optional().describe('Model name override (defaults to server AI config)'),
  aiConfig: z.record(z.unknown()).optional().describe('Custom AI configuration parameters'),
  avatarUrl: z.string().optional().describe('Avatar URL'),
}

export async function handleCreateBot(
  args: z.infer<ReturnType<typeof z.object<typeof createBotSchema>>>
) {
  const result = await botsApi.create({
    name: args.name,
    description: args.description ?? '',
    tags: args.tags ?? [],
    autoReply: args.autoReply ?? true,
    model: args.model,
    aiConfig: args.aiConfig,
    avatarUrl: args.avatarUrl,
  })
  return jsonResult(result)
}

// ── Update Bot ───────────────────────────────────────
export const updateBotSchema = {
  id: z.string().describe('Bot ID'),
  name: z.string().optional().describe('New name'),
  description: z.string().optional().describe('New description'),
  tags: z.array(z.string()).optional().describe('New tags'),
  autoReply: z.boolean().optional().describe('Whether to auto-reply'),
  sortOrder: z.number().optional().describe('Sort order'),
  model: z.string().nullable().optional().describe('Model override, or null to clear'),
  aiConfig: z
    .record(z.unknown())
    .nullable()
    .optional()
    .describe('Custom AI config, or null to clear'),
  avatarUrl: z.string().nullable().optional().describe('Avatar URL, or null to clear'),
}

export async function handleUpdateBot(
  args: z.infer<ReturnType<typeof z.object<typeof updateBotSchema>>>
) {
  const result = await botsApi.update(args.id, {
    name: args.name,
    description: args.description,
    tags: args.tags,
    autoReply: args.autoReply,
    sortOrder: args.sortOrder,
    model: args.model,
    aiConfig: args.aiConfig,
    avatarUrl: args.avatarUrl,
  })
  return jsonResult(result)
}

// ── Delete Bot ───────────────────────────────────────
export const deleteBotSchema = {
  id: z.string().describe('Bot ID to delete'),
}

export async function handleDeleteBot(
  args: z.infer<ReturnType<typeof z.object<typeof deleteBotSchema>>>
) {
  await botsApi.delete(args.id)
  return textResult(`Bot ${args.id} deleted successfully`)
}

// ── Reorder Bots ─────────────────────────────────────
export const reorderBotsSchema = {
  order: z.array(z.string()).describe('Complete ordered list of bot IDs'),
}

export async function handleReorderBots(
  args: z.infer<ReturnType<typeof z.object<typeof reorderBotsSchema>>>
) {
  await botsApi.reorder({ order: args.order })
  return textResult('Bots reordered successfully')
}

// ── Get Bot Replies ──────────────────────────────────
export const getBotRepliesSchema = {
  memoId: z.string().describe('Memo ID to get bot replies for'),
}

export async function handleGetBotReplies(
  args: z.infer<ReturnType<typeof z.object<typeof getBotRepliesSchema>>>
) {
  const result = await botsApi.getBotReplies(args.memoId)
  return jsonResult(result)
}

// ── Get Bot Thread ───────────────────────────────────
export const getBotThreadSchema = {
  replyId: z.string().describe('Bot reply ID to get thread for'),
}

export async function handleGetBotThread(
  args: z.infer<ReturnType<typeof z.object<typeof getBotThreadSchema>>>
) {
  const result = await botsApi.getBotThread(args.replyId)
  return jsonResult(result)
}

// ── Trigger Bot Replies ──────────────────────────────
export const triggerBotRepliesSchema = {
  memoId: z.string().describe('Memo ID to trigger bot replies for'),
}

export async function handleTriggerBotReplies(
  args: z.infer<ReturnType<typeof z.object<typeof triggerBotRepliesSchema>>>
) {
  await botsApi.triggerReplies(args.memoId)
  return textResult(
    `Bot replies triggered for memo ${args.memoId}. Poll bots_get_replies to check when replies are ready.`
  )
}

// ── Reply to Bot ─────────────────────────────────────
export const replyToBotSchema = {
  replyId: z.string().describe('Bot reply ID to respond to'),
  question: z.string().describe('Your follow-up question or message'),
  resourceIds: z.array(z.string()).optional().describe('Resource IDs (images) to attach'),
}

export async function handleReplyToBot(
  args: z.infer<ReturnType<typeof z.object<typeof replyToBotSchema>>>
) {
  const result = await botsApi.replyToBot(args.replyId, {
    question: args.question,
    resourceIds: args.resourceIds,
  })
  return jsonResult(result)
}

export const botsTools: McpToolDefinition[] = [
  {
    name: 'bots_list',
    title: 'List Bots',
    description: 'List all configured AI bots.',
    handler: () => handleListBots(),
  },
  {
    name: 'bots_get',
    title: 'Get Bot',
    description: 'Get a single AI bot by ID. Note: memoryStats is only populated by bots_list.',
    inputSchema: getBotSchema,
    handler: args => handleGetBot(args as Parameters<typeof handleGetBot>[0]),
  },
  {
    name: 'bots_create',
    title: 'Create Bot',
    description: 'Create a new AI bot with name, description, tags, and auto-reply settings.',
    inputSchema: createBotSchema,
    handler: args => handleCreateBot(args as Parameters<typeof handleCreateBot>[0]),
  },
  {
    name: 'bots_update',
    title: 'Update Bot',
    description:
      'Update an existing bot. All fields optional; pass null to clear avatarUrl, model, or aiConfig.',
    inputSchema: updateBotSchema,
    handler: args => handleUpdateBot(args as Parameters<typeof handleUpdateBot>[0]),
  },
  {
    name: 'bots_delete',
    title: 'Delete Bot',
    description: 'Permanently delete a bot by its ID. This cannot be undone.',
    inputSchema: deleteBotSchema,
    handler: args => handleDeleteBot(args as Parameters<typeof handleDeleteBot>[0]),
  },
  {
    name: 'bots_reorder',
    title: 'Reorder Bots',
    description: 'Set the display order of bots with a complete ordered list of bot IDs.',
    inputSchema: reorderBotsSchema,
    handler: args => handleReorderBots(args as Parameters<typeof handleReorderBots>[0]),
  },
  {
    name: 'bots_get_replies',
    title: 'Get Bot Replies',
    description: 'Get AI bot replies for a specific memo.',
    inputSchema: getBotRepliesSchema,
    handler: args => handleGetBotReplies(args as Parameters<typeof handleGetBotReplies>[0]),
  },
  {
    name: 'bots_get_thread',
    title: 'Get Bot Thread',
    description: 'Get the full conversation thread for a bot reply.',
    inputSchema: getBotThreadSchema,
    handler: args => handleGetBotThread(args as Parameters<typeof handleGetBotThread>[0]),
  },
  {
    name: 'bots_trigger_replies',
    title: 'Trigger Bot Replies',
    description:
      'Trigger AI bot replies for a memo. Returns immediately; poll bots_get_replies to check when replies are ready.',
    inputSchema: triggerBotRepliesSchema,
    handler: args => handleTriggerBotReplies(args as Parameters<typeof handleTriggerBotReplies>[0]),
  },
  {
    name: 'bots_reply',
    title: 'Reply to Bot',
    description:
      'Send a follow-up question to a bot reply, continuing the conversation. Optionally attach image resource IDs.',
    inputSchema: replyToBotSchema,
    handler: args => handleReplyToBot(args as Parameters<typeof handleReplyToBot>[0]),
  },
]
