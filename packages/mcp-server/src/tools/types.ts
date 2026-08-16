import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { z } from 'zod/v3'

export interface McpToolDefinition {
  name: string
  title: string
  description: string
  inputSchema?: z.ZodRawShape
  handler: (args: Record<string, unknown>) => Promise<CallToolResult>
}
