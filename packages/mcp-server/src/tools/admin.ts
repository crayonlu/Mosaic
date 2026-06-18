import { z } from 'zod/v3'
import type { MosaicClient } from '../client.js'
import { jsonResult, textResult } from '../result.js'

// ── Get AI Config ────────────────────────────────────
export async function handleGetAiConfig(client: MosaicClient) {
  const result = await client.getAiConfig()
  return jsonResult(result)
}

// ── Update AI Config ─────────────────────────────────
export const updateAiConfigSchema = {
  key: z.enum(['bot', 'embedding']).describe('Config key (bot or embedding)'),
  provider: z.string().describe('AI provider name'),
  baseUrl: z.string().describe('Provider base URL'),
  apiKey: z.string().describe('API key for the provider'),
  model: z.string().describe('Model name'),
  temperature: z.number().optional().describe('Temperature (0-2)'),
  maxTokens: z.number().optional().describe('Maximum tokens'),
  timeoutSeconds: z.number().optional().describe('Timeout in seconds'),
  supportsVision: z.enum(['true', 'false']).optional().describe('Whether model supports vision'),
  supportsThinking: z
    .enum(['true', 'false'])
    .optional()
    .describe('Whether model supports thinking'),
  embeddingDim: z.number().optional().describe('Embedding dimension'),
}

export async function handleUpdateAiConfig(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof updateAiConfigSchema>>>
) {
  const result = await client.updateAiConfig(args.key, {
    provider: args.provider,
    baseUrl: args.baseUrl,
    apiKey: args.apiKey,
    model: args.model,
    temperature: args.temperature,
    maxTokens: args.maxTokens,
    timeoutSeconds: args.timeoutSeconds,
    supportsVision: args.supportsVision === 'true',
    supportsThinking: args.supportsThinking === 'true',
    embeddingDim: args.embeddingDim,
  })
  return jsonResult(result)
}

// ── Backfill Memory ──────────────────────────────────
export async function handleBackfillMemory(client: MosaicClient) {
  const result = await client.backfillMemory()
  return textResult(result.message)
}
