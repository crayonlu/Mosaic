import { z } from 'zod/v3'
import type { MosaicClient } from '../client.js'
import { jsonResult, textResult } from '../result.js'

// ── Summarize ────────────────────────────────────────
export const summarizeSchema = {
  content: z.string().describe('Content to summarize'),
}

export async function handleSummarize(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof summarizeSchema>>>
) {
  const result = await client.summarize(args.content)
  return textResult(result.summary)
}

// ── Suggest Tags ─────────────────────────────────────
export const suggestTagsSchema = {
  content: z.string().describe('Content to analyze for tag suggestions'),
  existingTags: z.array(z.string()).optional().describe('Existing tags to consider'),
}

export async function handleSuggestTags(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof suggestTagsSchema>>>
) {
  const result = await client.suggestTags(args.content, args.existingTags)
  return jsonResult(result)
}
