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

interface ApiErrorLike {
  error?: string
  status?: number
  message?: string
}

function isApiError(error: unknown): error is ApiErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof (error as ApiErrorLike).error === 'string'
  )
}

/**
 * Convert an error into an actionable MCP error result so agents can
 * self-correct instead of guessing from a raw status code.
 */
export function errorResult(error: unknown): CallToolResult {
  let message: string

  if (isApiError(error)) {
    const detail = error.message ?? error.error
    switch (error.status) {
      case 401:
        message = `Authentication failed (401): ${detail}. The access token is invalid or expired. Restart the MCP server with a valid MOSAIC_TOKEN or MOSAIC_USERNAME/MOSAIC_PASSWORD.`
        break
      case 403:
        message = `Permission denied (403): ${detail}. This operation requires an admin account.`
        break
      case 404:
        message = `Not found (404): ${detail}. The requested resource does not exist or does not belong to the current user.`
        break
      case 400:
        message = `Invalid input (400): ${detail}`
        break
      default:
        message = `Mosaic API error (${error.status ?? 'unknown'}): ${detail}`
    }
  } else if (error instanceof Error) {
    message = `Request failed: ${error.message}`
  } else {
    message = `Request failed: ${String(error)}`
  }

  return textResult(`ERROR: ${message}`)
}
