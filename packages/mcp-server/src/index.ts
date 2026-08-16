#!/usr/bin/env node

/**
 * Mosaic MCP Server
 *
 * Exposes Mosaic journaling app capabilities as MCP tools.
 * All tools are thin wrappers over the shared @mosaic/api client.
 *
 * Environment variables:
 *   MOSAIC_SERVER_URL  - URL of the Mosaic backend (required)
 *   MOSAIC_TOKEN       - JWT access token for authentication
 *   MOSAIC_USERNAME    - Username (used with MOSAIC_PASSWORD if no token)
 *   MOSAIC_PASSWORD    - Password (used with MOSAIC_USERNAME if no token)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { getConfig, setupApiClient } from './client.js'
import { errorResult } from './result.js'
import type { McpToolDefinition } from './tools/types.js'
import { memosTools } from './tools/memos.js'
import { diariesTools } from './tools/diaries.js'
import { botsTools } from './tools/bots.js'
import { memoryTools } from './tools/memory.js'
import { statsTools } from './tools/stats.js'
import { aiTools } from './tools/ai.js'
import { adminTools } from './tools/admin.js'
import { resourcesTools } from './tools/resources.js'
import { authTools } from './tools/auth.js'

const tools: McpToolDefinition[] = [
  ...memosTools,
  ...diariesTools,
  ...botsTools,
  ...memoryTools,
  ...statsTools,
  ...aiTools,
  ...adminTools,
  ...resourcesTools,
  ...authTools,
]

async function main() {
  const config = getConfig()
  await setupApiClient(config)

  console.error(`Mosaic MCP Server: connected to ${config.serverUrl}`)

  const server = new McpServer(
    {
      name: 'mosaic-mcp-server',
      version: '0.2.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  )

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      async args => {
        try {
          return await tool.handler(args as Record<string, unknown>)
        } catch (error) {
          return errorResult(error)
        }
      }
    )
  }

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`Mosaic MCP Server running on stdio (${tools.length} tools)`)
}

main().catch(err => {
  console.error(`Fatal error: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
