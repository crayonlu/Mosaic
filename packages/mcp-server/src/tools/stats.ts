import { z } from 'zod/v3'
import type { MosaicClient } from '../client.js'
import { jsonResult } from '../result.js'

// ── Get Heatmap ──────────────────────────────────────
export const getHeatmapSchema = {
  startDate: z.string().describe('Start date (YYYY-MM-DD)'),
  endDate: z.string().describe('End date (YYYY-MM-DD)'),
}

export async function handleGetHeatmap(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof getHeatmapSchema>>>
) {
  const result = await client.getHeatmap({
    startDate: args.startDate,
    endDate: args.endDate,
  })
  return jsonResult(result)
}

// ── Get Timeline ─────────────────────────────────────
export const getTimelineSchema = {
  startDate: z.string().describe('Start date (YYYY-MM-DD)'),
  endDate: z.string().describe('End date (YYYY-MM-DD)'),
}

export async function handleGetTimeline(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof getTimelineSchema>>>
) {
  const result = await client.getTimeline({
    startDate: args.startDate,
    endDate: args.endDate,
  })
  return jsonResult(result)
}

// ── Get Trends ───────────────────────────────────────
export const getTrendsSchema = {
  startDate: z.string().describe('Start date (YYYY-MM-DD)'),
  endDate: z.string().describe('End date (YYYY-MM-DD)'),
}

export async function handleGetTrends(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof getTrendsSchema>>>
) {
  const result = await client.getTrends({
    startDate: args.startDate,
    endDate: args.endDate,
  })
  return jsonResult(result)
}

// ── Get Stats Summary ────────────────────────────────
export const getStatsSummarySchema = {
  year: z.number().describe('Year'),
  month: z.number().min(1).max(12).describe('Month (1-12)'),
}

export async function handleGetStatsSummary(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof getStatsSummarySchema>>>
) {
  const result = await client.getStatsSummary({
    year: args.year,
    month: args.month,
  })
  return jsonResult(result)
}
