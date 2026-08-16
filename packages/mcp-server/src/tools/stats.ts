import { z } from 'zod/v3'
import { statsApi } from '@mosaic/api/node'
import { jsonResult } from '../result.js'
import type { McpToolDefinition } from './types.js'

// ── Get Heatmap ──────────────────────────────────────
export const getHeatmapSchema = {
  startDate: z.string().describe('Start date (YYYY-MM-DD)'),
  endDate: z.string().describe('End date (YYYY-MM-DD)'),
}

export async function handleGetHeatmap(
  args: z.infer<ReturnType<typeof z.object<typeof getHeatmapSchema>>>
) {
  const result = await statsApi.getHeatmap(args)
  return jsonResult(result)
}

// ── Get Timeline ─────────────────────────────────────
export const getTimelineSchema = {
  startDate: z.string().describe('Start date (YYYY-MM-DD)'),
  endDate: z.string().describe('End date (YYYY-MM-DD)'),
}

export async function handleGetTimeline(
  args: z.infer<ReturnType<typeof z.object<typeof getTimelineSchema>>>
) {
  const result = await statsApi.getTimeline(args)
  return jsonResult(result)
}

// ── Get Trends ───────────────────────────────────────
export const getTrendsSchema = {
  startDate: z.string().describe('Start date (YYYY-MM-DD)'),
  endDate: z.string().describe('End date (YYYY-MM-DD)'),
}

export async function handleGetTrends(
  args: z.infer<ReturnType<typeof z.object<typeof getTrendsSchema>>>
) {
  const result = await statsApi.getTrends(args)
  return jsonResult(result)
}

// ── Get Stats Summary ────────────────────────────────
export const getStatsSummarySchema = {
  year: z.number().describe('Year'),
  month: z.number().min(1).max(12).describe('Month (1-12)'),
}

export async function handleGetStatsSummary(
  args: z.infer<ReturnType<typeof z.object<typeof getStatsSummarySchema>>>
) {
  const result = await statsApi.getSummary(args)
  return jsonResult(result)
}

export const statsTools: McpToolDefinition[] = [
  {
    name: 'stats_heatmap',
    title: 'Get Heatmap Data',
    description: 'Get heatmap data for visualization of memo/mood activity over a date range.',
    inputSchema: getHeatmapSchema,
    handler: args => handleGetHeatmap(args as Parameters<typeof handleGetHeatmap>[0]),
  },
  {
    name: 'stats_timeline',
    title: 'Get Timeline Data',
    description: 'Get timeline entries with mood and memo counts for a date range.',
    inputSchema: getTimelineSchema,
    handler: args => handleGetTimeline(args as Parameters<typeof handleGetTimeline>[0]),
  },
  {
    name: 'stats_trends',
    title: 'Get Trends Data',
    description: 'Get mood and tag trends for a date range.',
    inputSchema: getTrendsSchema,
    handler: args => handleGetTrends(args as Parameters<typeof handleGetTrends>[0]),
  },
  {
    name: 'stats_summary',
    title: 'Get Stats Summary',
    description: 'Get a monthly summary of total memos, diaries, and resources.',
    inputSchema: getStatsSummarySchema,
    handler: args => handleGetStatsSummary(args as Parameters<typeof handleGetStatsSummary>[0]),
  },
]
