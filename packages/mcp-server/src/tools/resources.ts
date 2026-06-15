import { z } from 'zod/v3'
import type { MosaicClient } from '../client.js'
import { jsonResult } from '../result.js'

// ── List Resources ───────────────────────────────────
export const listResourcesSchema = {
  page: z.number().optional().describe('Page number (1-based)'),
  pageSize: z.number().optional().describe('Items per page'),
}

export async function handleListResources(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof listResourcesSchema>>>
) {
  const result = await client.listResources({
    page: args.page,
    pageSize: args.pageSize,
  })
  return jsonResult(result)
}

// ── Get Resource ─────────────────────────────────────
export const getResourceSchema = {
  id: z.string().describe('Resource ID'),
}

export async function handleGetResource(
  client: MosaicClient,
  args: z.infer<ReturnType<typeof z.object<typeof getResourceSchema>>>
) {
  const result = await client.getResource(args.id)
  return jsonResult(result)
}
