import { z } from 'zod/v3'
import type { MosaicClient } from '../client.js'
import { jsonResult, textResult } from '../result.js'

// ── List Bots ────────────────────────────────────────
export async function handleListBots(client: MosaicClient) {
  const result = await client.listBots()
  return jsonResult(result)
}

// ── Get Bot Replies ──────────────────────────────────
export const getBotRepliesSchema = {
  memoId: z.string().describe('Memo ID to get bot replies for'),
}

export async function handleGetBotReplies(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof getBotRepliesSchema>>>
) {
  const result = await client.getBotReplies(args.memoId)
  return jsonResult(result)
}

// ── Get Bot Thread ───────────────────────────────────
export const getBotThreadSchema = {
  replyId: z.string().describe('Bot reply ID to get thread for'),
}

export async function handleGetBotThread(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof getBotThreadSchema>>>
) {
  const result = await client.getBotThread(args.replyId)
  return jsonResult(result)
}

// ── Trigger Bot Replies ──────────────────────────────
export const triggerBotRepliesSchema = {
  memoId: z.string().describe('Memo ID to trigger bot replies for'),
}

export async function handleTriggerBotReplies(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof triggerBotRepliesSchema>>>
) {
  await client.triggerBotReplies(args.memoId)
  return textResult(`Bot replies triggered for memo ${args.memoId}`)
}

// ── Reply to Bot ─────────────────────────────────────
export const replyToBotSchema = {
  replyId: z.string().describe('Bot reply ID to respond to'),
  question: z.string().describe('Your follow-up question or message'),
}

export async function handleReplyToBot(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof replyToBotSchema>>>
) {
  const result = await client.replyToBot(args.replyId, args.question)
  return jsonResult(result)
}
