#!/usr/bin/env node

/**
 * Mosaic MCP Server
 *
 * Exposes Mosaic journaling app capabilities as MCP tools.
 *
 * Environment variables:
 *   MOSAIC_SERVER_URL  - URL of the Mosaic backend (required)
 *   MOSAIC_TOKEN       - JWT access token for authentication
 *   MOSAIC_USERNAME    - Username (used with MOSAIC_PASSWORD if no token)
 *   MOSAIC_PASSWORD    - Password (used with MOSAIC_USERNAME if no token)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { MosaicClient } from './client.js'
import {
  handleSearchMemos,
  searchMemosSchema,
  handleListMemos,
  listMemosSchema,
  handleGetMemo,
  getMemosSchema,
  handleCreateMemo,
  createMemoSchema,
  handleUpdateMemo,
  updateMemoSchema,
  handleDeleteMemo,
  deleteMemosSchema,
  handleArchiveMemo,
  archiveMemosSchema,
  handleUnarchiveMemo,
  unarchiveMemoSchema,
  handleGetTags,
  handleClipToMemo,
  clipMemosSchema,
} from './tools/memos.js'
import {
  handleListDiaries,
  listDiariesSchema,
  handleGetDiary,
  getDiarySchema,
  handleCreateOrUpdateDiary,
  createOrUpdateDiarySchema,
  handleUpdateDiarySummary,
  updateDiarySummarySchema,
  handleUpdateDiaryMood,
  updateDiaryMoodSchema,
} from './tools/diaries.js'
import {
  handleListBots,
  handleGetBotReplies,
  getBotRepliesSchema,
  handleGetBotThread,
  getBotThreadSchema,
  handleTriggerBotReplies,
  triggerBotRepliesSchema,
  handleReplyToBot,
  replyToBotSchema,
} from './tools/bots.js'
import {
  handleGetMemoryStats,
  handleGetMemoryActivity,
  getMemoryActivitySchema,
  handleGetMemoryContext,
  getMemoryContextSchema,
  handleGetMemoContexts,
  getMemoContextsSchema,
} from './tools/memory.js'
import {
  handleGetHeatmap,
  getHeatmapSchema,
  handleGetTimeline,
  getTimelineSchema,
  handleGetTrends,
  getTrendsSchema,
  handleGetStatsSummary,
  getStatsSummarySchema,
} from './tools/stats.js'
import {
  handleSummarize,
  summarizeSchema,
  handleSuggestTags,
  suggestTagsSchema,
} from './tools/ai.js'
import {
  handleGetAiConfig,
  handleUpdateAiConfig,
  updateAiConfigSchema,
  handleBackfillMemory,
} from './tools/admin.js'
import {
  handleListResources,
  listResourcesSchema,
  handleGetResource,
  getResourceSchema,
} from './tools/resources.js'

function getConfig() {
  const serverUrl = process.env.MOSAIC_SERVER_URL
  if (!serverUrl) {
    console.error('ERROR: MOSAIC_SERVER_URL environment variable is required')
    process.exit(1)
  }

  return {
    serverUrl,
    token: process.env.MOSAIC_TOKEN,
    username: process.env.MOSAIC_USERNAME,
    password: process.env.MOSAIC_PASSWORD,
  }
}

async function main() {
  const config = getConfig()
  const client = new MosaicClient(config)

  // Verify connection
  try {
    const health = await client.health()
    console.error(`Connected to Mosaic server v${health.version} (status: ${health.status})`)
  } catch (err) {
    console.error('Warning: Could not verify server health:', (err as Error).message)
    console.error('The server will retry authentication on first tool call.')
  }

  // Create MCP server
  const server = new McpServer(
    {
      name: 'mosaic-mcp-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  )

  // ── Memo Tools ─────────────────────────────────────

  server.registerTool(
    'memos_search',
    {
      title: 'Search Memos',
      description:
        'Search memos by full-text query, tags, and date range. Supports semantic search when configured.',
      inputSchema: searchMemosSchema,
    },
    async args => handleSearchMemos(client, args)
  )

  server.registerTool(
    'memos_list',
    {
      title: 'List Memos',
      description:
        'List memos with pagination and optional filters for archive status and diary date.',
      inputSchema: listMemosSchema,
    },
    async args => handleListMemos(client, args)
  )

  server.registerTool(
    'memos_get',
    {
      title: 'Get Memo',
      description: 'Get a single memo by its ID.',
      inputSchema: getMemosSchema,
    },
    async args => handleGetMemo(client, args)
  )

  server.registerTool(
    'memos_create',
    {
      title: 'Create Memo',
      description: 'Create a new memo with content, tags, and optional diary date.',
      inputSchema: createMemoSchema,
    },
    async args => handleCreateMemo(client, args)
  )

  server.registerTool(
    'memos_update',
    {
      title: 'Update Memo',
      description: 'Update an existing memo content, tags, or diary date.',
      inputSchema: updateMemoSchema,
    },
    async args => handleUpdateMemo(client, args)
  )

  server.registerTool(
    'memos_delete',
    {
      title: 'Delete Memo',
      description: 'Permanently delete a memo by its ID.',
      inputSchema: deleteMemosSchema,
    },
    async args => handleDeleteMemo(client, args)
  )

  server.registerTool(
    'memos_archive',
    {
      title: 'Archive Memo',
      description: 'Archive a memo, optionally linking it to a diary date.',
      inputSchema: archiveMemosSchema,
    },
    async args => handleArchiveMemo(client, args)
  )

  server.registerTool(
    'memos_unarchive',
    {
      title: 'Unarchive Memo',
      description: 'Restore an archived memo.',
      inputSchema: unarchiveMemoSchema,
    },
    async args => handleUnarchiveMemo(client, args)
  )

  server.registerTool(
    'memos_tags',
    {
      title: 'Get Memo Tags',
      description: 'List all tags used across memos with their usage counts.',
    },
    async () => handleGetTags(client)
  )

  server.registerTool(
    'memos_clip',
    {
      title: 'Clip to Memo',
      description:
        'Clip a URL, text, or image to create a new memo with AI-generated summary and tags.',
      inputSchema: clipMemosSchema,
    },
    async args => handleClipToMemo(client, args)
  )

  // ── Diary Tools ────────────────────────────────────

  server.registerTool(
    'diaries_list',
    {
      title: 'List Diaries',
      description: 'List diary entries with pagination and date range filter.',
      inputSchema: listDiariesSchema,
    },
    async args => handleListDiaries(client, args)
  )

  server.registerTool(
    'diaries_get',
    {
      title: 'Get Diary',
      description: 'Get a single diary entry by date, including linked memos.',
      inputSchema: getDiarySchema,
    },
    async args => handleGetDiary(client, args)
  )

  server.registerTool(
    'diaries_create_or_update',
    {
      title: 'Create or Update Diary',
      description: 'Create a new diary entry or update an existing one for a given date.',
      inputSchema: createOrUpdateDiarySchema,
    },
    async args => handleCreateOrUpdateDiary(client, args)
  )

  server.registerTool(
    'diaries_update_summary',
    {
      title: 'Update Diary Summary',
      description: 'Update the summary text of an existing diary entry.',
      inputSchema: updateDiarySummarySchema,
    },
    async args => handleUpdateDiarySummary(client, args)
  )

  server.registerTool(
    'diaries_update_mood',
    {
      title: 'Update Diary Mood',
      description: 'Update the mood (key and score) of an existing diary entry.',
      inputSchema: updateDiaryMoodSchema,
    },
    async args => handleUpdateDiaryMood(client, args)
  )

  // ── Bot Tools ──────────────────────────────────────

  server.registerTool(
    'bots_list',
    {
      title: 'List Bots',
      description: 'List all configured AI bots.',
    },
    async () => handleListBots(client)
  )

  server.registerTool(
    'bots_get_replies',
    {
      title: 'Get Bot Replies',
      description: 'Get AI bot replies for a specific memo.',
      inputSchema: getBotRepliesSchema,
    },
    async args => handleGetBotReplies(client, args)
  )

  server.registerTool(
    'bots_get_thread',
    {
      title: 'Get Bot Thread',
      description: 'Get the full conversation thread for a bot reply.',
      inputSchema: getBotThreadSchema,
    },
    async args => handleGetBotThread(client, args)
  )

  server.registerTool(
    'bots_trigger_replies',
    {
      title: 'Trigger Bot Replies',
      description: 'Trigger AI bot replies for a memo.',
      inputSchema: triggerBotRepliesSchema,
    },
    async args => handleTriggerBotReplies(client, args)
  )

  server.registerTool(
    'bots_reply',
    {
      title: 'Reply to Bot',
      description: 'Send a follow-up question to a bot reply, continuing the conversation.',
      inputSchema: replyToBotSchema,
    },
    async args => handleReplyToBot(client, args)
  )

  // ── Memory Tools ───────────────────────────────────

  server.registerTool(
    'memory_stats',
    {
      title: 'Get Memory Stats',
      description: 'Get memory system statistics (total/indexed memos).',
    },
    async () => handleGetMemoryStats(client)
  )

  server.registerTool(
    'memory_activity',
    {
      title: 'Get Memory Activity',
      description: 'Get recent memory retrieval activity.',
      inputSchema: getMemoryActivitySchema,
    },
    async args => handleGetMemoryActivity(client, args)
  )

  server.registerTool(
    'memory_context',
    {
      title: 'Get Memory Context',
      description: 'Get memory context for a memo and bot pair, showing relevant past memos.',
      inputSchema: getMemoryContextSchema,
    },
    async args => handleGetMemoryContext(client, args)
  )

  server.registerTool(
    'memory_memo_contexts',
    {
      title: 'Get Memo Contexts',
      description: 'Get memory contexts for a memo across all bots.',
      inputSchema: getMemoContextsSchema,
    },
    async args => handleGetMemoContexts(client, args)
  )

  // ── Stats Tools ────────────────────────────────────

  server.registerTool(
    'stats_heatmap',
    {
      title: 'Get Heatmap Data',
      description: 'Get heatmap data for visualization of memo/mood activity over a date range.',
      inputSchema: getHeatmapSchema,
    },
    async args => handleGetHeatmap(client, args)
  )

  server.registerTool(
    'stats_timeline',
    {
      title: 'Get Timeline Data',
      description: 'Get timeline entries with mood and memo counts for a date range.',
      inputSchema: getTimelineSchema,
    },
    async args => handleGetTimeline(client, args)
  )

  server.registerTool(
    'stats_trends',
    {
      title: 'Get Trends Data',
      description: 'Get mood and tag trends for a date range.',
      inputSchema: getTrendsSchema,
    },
    async args => handleGetTrends(client, args)
  )

  server.registerTool(
    'stats_summary',
    {
      title: 'Get Stats Summary',
      description: 'Get a monthly summary of total memos, diaries, and resources.',
      inputSchema: getStatsSummarySchema,
    },
    async args => handleGetStatsSummary(client, args)
  )

  // ── AI Tools ───────────────────────────────────────

  server.registerTool(
    'ai_summarize',
    {
      title: 'Summarize Content',
      description: 'Use AI to generate a summary of provided text content.',
      inputSchema: summarizeSchema,
    },
    async args => handleSummarize(client, args)
  )

  server.registerTool(
    'ai_suggest_tags',
    {
      title: 'Suggest Tags',
      description: 'Use AI to suggest relevant tags for provided content.',
      inputSchema: suggestTagsSchema,
    },
    async args => handleSuggestTags(client, args)
  )

  // ── Admin Tools ────────────────────────────────────

  server.registerTool(
    'admin_get_ai_config',
    {
      title: 'Get AI Config',
      description: 'Get the current AI provider configuration for bot and embedding models.',
    },
    async () => handleGetAiConfig(client)
  )

  server.registerTool(
    'admin_update_ai_config',
    {
      title: 'Update AI Config',
      description: 'Update the AI provider configuration for bot or embedding models.',
      inputSchema: updateAiConfigSchema,
    },
    async args => handleUpdateAiConfig(client, args)
  )

  server.registerTool(
    'admin_backfill_memory',
    {
      title: 'Backfill Memory',
      description: 'Trigger a backfill of the memory/indexing system for all existing memos.',
    },
    async () => handleBackfillMemory(client)
  )

  // ── Resource Tools ─────────────────────────────────

  server.registerTool(
    'resources_list',
    {
      title: 'List Resources',
      description: 'List uploaded resources (images, videos) with pagination.',
      inputSchema: listResourcesSchema,
    },
    async args => handleListResources(client, args)
  )

  server.registerTool(
    'resources_get',
    {
      title: 'Get Resource',
      description: 'Get details for a single resource by ID.',
      inputSchema: getResourceSchema,
    },
    async args => handleGetResource(client, args)
  )

  // ── Start Server ───────────────────────────────────

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Mosaic MCP Server running on stdio')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
