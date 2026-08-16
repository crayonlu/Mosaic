import { z } from 'zod/v3'
import { diariesApi } from '@mosaic/api/node'
import { jsonResult } from '../result.js'
import type { McpToolDefinition } from './types.js'

// ── List Diaries ─────────────────────────────────────
export const listDiariesSchema = {
  page: z.number().optional().describe('Page number (1-based)'),
  pageSize: z.number().max(200).optional().describe('Items per page (max 200)'),
  startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
}

export async function handleListDiaries(
  args: z.infer<ReturnType<typeof z.object<typeof listDiariesSchema>>>
) {
  const result = await diariesApi.list(args)
  return jsonResult(result)
}

// ── Get Diary ────────────────────────────────────────
export const getDiarySchema = {
  date: z.string().describe('Diary date (YYYY-MM-DD)'),
}

export async function handleGetDiary(
  args: z.infer<ReturnType<typeof z.object<typeof getDiarySchema>>>
) {
  const result = await diariesApi.get(args.date)
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
  moodScore: z.number().min(1).max(10).optional().describe('Mood score (1-10)'),
}

export async function handleCreateOrUpdateDiary(
  args: z.infer<ReturnType<typeof z.object<typeof createOrUpdateDiarySchema>>>
) {
  const result = await diariesApi.createOrUpdate(args.date, {
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
  args: z.infer<ReturnType<typeof z.object<typeof updateDiarySummarySchema>>>
) {
  const result = await diariesApi.updateSummary(args.date, { summary: args.summary })
  return jsonResult(result)
}

// ── Update Diary Mood ────────────────────────────────
export const updateDiaryMoodSchema = {
  date: z.string().describe('Diary date (YYYY-MM-DD)'),
  moodKey: z.enum(moodKeys).describe('Mood for the day'),
  moodScore: z.number().min(1).max(10).describe('Mood score (1-10)'),
}

export async function handleUpdateDiaryMood(
  args: z.infer<ReturnType<typeof z.object<typeof updateDiaryMoodSchema>>>
) {
  const result = await diariesApi.updateMood(args.date, {
    moodKey: args.moodKey,
    moodScore: args.moodScore,
  })
  return jsonResult(result)
}

export const diariesTools: McpToolDefinition[] = [
  {
    name: 'diaries_list',
    title: 'List Diaries',
    description: 'List diary entries with pagination and date range filter.',
    inputSchema: listDiariesSchema,
    handler: args => handleListDiaries(args as Parameters<typeof handleListDiaries>[0]),
  },
  {
    name: 'diaries_get',
    title: 'Get Diary',
    description: 'Get a single diary entry by date, including linked memos.',
    inputSchema: getDiarySchema,
    handler: args => handleGetDiary(args as Parameters<typeof handleGetDiary>[0]),
  },
  {
    name: 'diaries_create_or_update',
    title: 'Create or Update Diary',
    description:
      'Create a new diary entry or update an existing one for a given date. Mood score is 1-10.',
    inputSchema: createOrUpdateDiarySchema,
    handler: args =>
      handleCreateOrUpdateDiary(args as Parameters<typeof handleCreateOrUpdateDiary>[0]),
  },
  {
    name: 'diaries_update_summary',
    title: 'Update Diary Summary',
    description: 'Update the summary text of an existing diary entry.',
    inputSchema: updateDiarySummarySchema,
    handler: args =>
      handleUpdateDiarySummary(args as Parameters<typeof handleUpdateDiarySummary>[0]),
  },
  {
    name: 'diaries_update_mood',
    title: 'Update Diary Mood',
    description: 'Update the mood (key and score 1-10) of an existing diary entry.',
    inputSchema: updateDiaryMoodSchema,
    handler: args => handleUpdateDiaryMood(args as Parameters<typeof handleUpdateDiaryMood>[0]),
  },
]
