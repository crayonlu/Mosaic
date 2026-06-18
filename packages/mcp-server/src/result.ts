import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

/**
 * Create a CallToolResult with text content.
 * Using a factory function ensures proper literal types.
 */
export function textResult(text: string): CallToolResult {
  return {
    content: [
      {
        type: 'text' as const,
        text,
      },
    ],
  }
}

/**
 * Create a CallToolResult with JSON content (pretty-printed).
 */
export function jsonResult(data: unknown): CallToolResult {
  return textResult(JSON.stringify(data, null, 2))
}
