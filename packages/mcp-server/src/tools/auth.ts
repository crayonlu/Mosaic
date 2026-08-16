import { authApi } from '@mosaic/api/node'
import { jsonResult } from '../result.js'
import type { McpToolDefinition } from './types.js'

// ── Get Current User ─────────────────────────────────
export async function handleGetMe() {
  const result = await authApi.me()
  return jsonResult(result)
}

export const authTools: McpToolDefinition[] = [
  {
    name: 'auth_me',
    title: 'Get Current User',
    description:
      'Get the currently authenticated user (id, username, role, mustChangePassword). Note: user timestamps are in seconds, unlike other Mosaic APIs which use milliseconds.',
    handler: () => handleGetMe(),
  },
]
