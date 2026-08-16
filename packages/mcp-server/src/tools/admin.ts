import { z } from 'zod/v3'
import { adminApi } from '@mosaic/api/node'
import { jsonResult, textResult } from '../result.js'
import type { McpToolDefinition } from './types.js'

// ── Get AI Config ────────────────────────────────────
export async function handleGetAiConfig() {
  const result = await adminApi.getAiConfig()
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
  supportsVision: z.boolean().optional().describe('Whether model supports vision'),
  supportsThinking: z.boolean().optional().describe('Whether model supports thinking'),
  embeddingDim: z.number().optional().describe('Embedding dimension'),
}

export async function handleUpdateAiConfig(
  args: z.infer<ReturnType<typeof z.object<typeof updateAiConfigSchema>>>
) {
  const result = await adminApi.updateAiConfig(args.key, {
    provider: args.provider,
    baseUrl: args.baseUrl,
    apiKey: args.apiKey,
    model: args.model,
    temperature: args.temperature,
    maxTokens: args.maxTokens,
    timeoutSeconds: args.timeoutSeconds,
    supportsVision: args.supportsVision,
    supportsThinking: args.supportsThinking,
    embeddingDim: args.embeddingDim,
  })
  return jsonResult(result)
}

// ── Backfill Memory ──────────────────────────────────
export async function handleBackfillMemory() {
  const result = await adminApi.backfillMemory()
  return textResult(
    `${result.message}. Poll admin_activity to observe backfill progress (backfill events appear in the activity log).`
  )
}

// ── Get App Settings ─────────────────────────────────
export async function handleGetSettings() {
  const result = await adminApi.getSettings()
  return jsonResult(result)
}

// ── Update App Settings ──────────────────────────────
export const updateSettingsSchema = {
  autoTagEnabled: z.boolean().describe('Auto-generate tags for new memos'),
  autoSummaryEnabled: z.boolean().describe('Auto-generate AI summaries'),
  autoDiaryEnabled: z.boolean().describe('Auto-generate diary entries'),
  autoDiaryMinMemos: z.number().min(1).describe('Minimum memos per day to auto-generate diary'),
  autoDiaryMinChars: z
    .number()
    .min(1)
    .describe('Minimum total chars per day to auto-generate diary'),
  appTimezone: z.string().describe('IANA timezone name, e.g. Asia/Shanghai'),
}

export async function handleUpdateSettings(
  args: z.infer<ReturnType<typeof z.object<typeof updateSettingsSchema>>>
) {
  const result = await adminApi.updateSettings({
    autoTagEnabled: args.autoTagEnabled,
    autoSummaryEnabled: args.autoSummaryEnabled,
    autoDiaryEnabled: args.autoDiaryEnabled,
    autoDiaryMinMemos: args.autoDiaryMinMemos,
    autoDiaryMinChars: args.autoDiaryMinChars,
    appTimezone: args.appTimezone,
  })
  return jsonResult(result)
}

// ── Admin Health ─────────────────────────────────────
export async function handleAdminHealth() {
  const result = await adminApi.health()
  return jsonResult(result)
}

// ── Admin Activity ───────────────────────────────────
export const getActivitySchema = {
  limit: z.number().max(200).optional().describe('Number of entries to return (default 50)'),
  level: z.string().optional().describe('Filter by log level (e.g. info)'),
}

export async function handleGetActivity(
  args: z.infer<ReturnType<typeof z.object<typeof getActivitySchema>>>
) {
  const result = await adminApi.activity(args.limit ?? 50, args.level)
  return jsonResult(result)
}

export const adminTools: McpToolDefinition[] = [
  {
    name: 'admin_get_ai_config',
    title: 'Get AI Config',
    description:
      'Get the current AI provider configuration for bot and embedding models. Requires an admin account.',
    handler: () => handleGetAiConfig(),
  },
  {
    name: 'admin_update_ai_config',
    title: 'Update AI Config',
    description:
      'Update the AI provider configuration for bot or embedding models. Requires an admin account.',
    inputSchema: updateAiConfigSchema,
    handler: args => handleUpdateAiConfig(args as Parameters<typeof handleUpdateAiConfig>[0]),
  },
  {
    name: 'admin_backfill_memory',
    title: 'Backfill Memory',
    description:
      'Trigger a backfill of the memory/indexing system for all existing memos. Runs asynchronously; poll admin_activity to observe progress. Requires an admin account.',
    handler: () => handleBackfillMemory(),
  },
  {
    name: 'admin_settings_get',
    title: 'Get App Settings',
    description:
      'Get global app settings (auto-tag, auto-summary, auto-diary, timezone). Requires an admin account.',
    handler: () => handleGetSettings(),
  },
  {
    name: 'admin_settings_update',
    title: 'Update App Settings',
    description:
      'Update global app settings. All six fields are required; appTimezone must be a valid IANA timezone name. Requires an admin account.',
    inputSchema: updateSettingsSchema,
    handler: args => handleUpdateSettings(args as Parameters<typeof handleUpdateSettings>[0]),
  },
  {
    name: 'admin_health',
    title: 'Get Admin Health',
    description:
      'Get server health and storage usage (uptime, storage, database size). Requires an admin account.',
    handler: () => handleAdminHealth(),
  },
  {
    name: 'admin_activity',
    title: 'Get Admin Activity Log',
    description:
      'Get recent admin activity log entries (in-memory ring buffer, last 200 entries, cleared on server restart). Requires an admin account.',
    inputSchema: getActivitySchema,
    handler: args => handleGetActivity(args as Parameters<typeof handleGetActivity>[0]),
  },
]
