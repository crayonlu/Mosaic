import { z } from 'zod/v3'
import type { MosaicClient } from '../client.js'
import { jsonResult } from '../result.js'

// ── List Diaries ─────────────────────────────────────
export const listDiariesSchema = {
  page: z.number().optional().describe('Page number (1-based)'),
  pageSize: z.number().optional().describe('Items per page'),
  startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
}

export async function handleListDiaries(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof listDiariesSchema>>>
) {
  const result = await client.listDiaries({
    page: args.page,
    pageSize: args.pageSize,
    startDate: args.startDate,
    endDate: args.endDate,
  })
  return jsonResult(result)
}

// ── Get Diary ────────────────────────────────────────
export const getDiarySchema = {
  date: z.string().describe('Diary date (YYYY-MM-DD)'),
}

export async function handleGetDiary(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof getDiarySchema>>>
) {
  const result = await client.getDiary(args.date)
  return jsonResult(result)
}

// ── Create or Update Diary ───────────────────────────
const moodKeys = [
  'joy',
  'calm',
  'neutral',
  'sadness',
  'anxiety',
  'anger',
  'focus',
  'tired',
] as const
export const createOrUpdateDiarySchema = {
  date: z.string().describe('Diary date (YYYY-MM-DD)'),
  summary: z.string().optional().describe('Diary summary'),
  moodKey: z.enum(moodKeys).optional().describe('Mood for the day'),
  moodScore: z.number().min(0).max(10).optional().describe('Mood score (0-10)'),
}

export async function handleCreateOrUpdateDiary(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof createOrUpdateDiarySchema>>>
) {
  const result = await client.createOrUpdateDiary(args.date, {
    summary: args.summary,
    moodKey: args.moodKey,
    moodScore: args.moodScore,
  })
  return jsonResult(result)
}

// ── Update Diary Summary ─────────────────────────────
export const updateDiarySummarySchema = {
  date: z.string().describe('Diary date (YYYY-MM-DD)'),
  summary: z.string().describe('New summary text'),
}

export async function handleUpdateDiarySummary(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof updateDiarySummarySchema>>>
) {
  const result = await client.updateDiarySummary(args.date, args.summary)
  return jsonResult(result)
}

// ── Update Diary Mood ────────────────────────────────
export const updateDiaryMoodSchema = {
  date: z.string().describe('Diary date (YYYY-MM-DD)'),
  moodKey: z.enum(moodKeys).describe('Mood for the day'),
  moodScore: z.number().min(0).max(10).describe('Mood score (0-10)'),
}

export async function handleUpdateDiaryMood(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof updateDiaryMoodSchema>>>
) {
  const result = await client.updateDiaryMood(args.date, args.moodKey, args.moodScore)
  return jsonResult(result)
}
