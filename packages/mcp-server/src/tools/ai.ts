import { z } from 'zod/v3'
import { aiApi } from '@mosaic/api/node'
import { jsonResult, textResult } from '../result.js'
import type { McpToolDefinition } from './types.js'

// ── Summarize ────────────────────────────────────────
export const summarizeSchema = {
  content: z.string().describe('Content to summarize'),
}

export async function handleSummarize(
  args: z.infer<ReturnType<typeof z.object<typeof summarizeSchema>>>
) {
  const result = await aiApi.summarize(args.content)
  return textResult(result.summary)
}

// ── Suggest Tags ─────────────────────────────────────
export const suggestTagsSchema = {
  content: z.string().describe('Content to analyze for tag suggestions'),
  existingTags: z.array(z.string()).optional().describe('Existing tags to consider'),
}

export async function handleSuggestTags(
  args: z.infer<ReturnType<typeof z.object<typeof suggestTagsSchema>>>
) {
  const result = await aiApi.suggestTags(args.content, args.existingTags)
  return jsonResult(result)
}

export const aiTools: McpToolDefinition[] = [
  {
    name: 'ai_summarize',
    title: 'Summarize Content',
    description: 'Use AI to generate a summary of provided text content.',
    inputSchema: summarizeSchema,
    handler: args => handleSummarize(args as Parameters<typeof handleSummarize>[0]),
  },
  {
    name: 'ai_suggest_tags',
    title: 'Suggest Tags',
    description: 'Use AI to suggest relevant tags for provided content.',
    inputSchema: suggestTagsSchema,
    handler: args => handleSuggestTags(args as Parameters<typeof handleSuggestTags>[0]),
  },
]
