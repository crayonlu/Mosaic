import { z } from 'zod/v3'
import { resourcesApi } from '@mosaic/api/node'
import { jsonResult, textResult } from '../result.js'
import type { McpToolDefinition } from './types.js'

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

// ── List Resources ───────────────────────────────────
export const listResourcesSchema = {
  page: z.number().optional().describe('Page number (1-based)'),
  pageSize: z.number().max(200).optional().describe('Items per page (max 200)'),
}

export async function handleListResources(
  args: z.infer<ReturnType<typeof z.object<typeof listResourcesSchema>>>
) {
  const result = await resourcesApi.list(args)
  return jsonResult(result)
}

// ── Get Resource ─────────────────────────────────────
export const getResourceSchema = {
  id: z.string().describe('Resource ID'),
}

export async function handleGetResource(
  args: z.infer<ReturnType<typeof z.object<typeof getResourceSchema>>>
) {
  const result = await resourcesApi.get(args.id)
  return jsonResult(result)
}

// ── Upload Resource ──────────────────────────────────
export const uploadResourceSchema = {
  filename: z.string().describe('File name with extension'),
  dataBase64: z.string().describe('File content as base64 string (max 20MB)'),
  mimeType: z.string().optional().describe('MIME type (defaults to image/jpeg)'),
  memoId: z.string().optional().describe('Memo ID to attach the resource to'),
  metadata: z
    .record(z.unknown())
    .optional()
    .describe('Metadata object, e.g. { width, height, durationMs }'),
}

export async function handleUploadResource(
  args: z.infer<ReturnType<typeof z.object<typeof uploadResourceSchema>>>
) {
  const data = Buffer.from(args.dataBase64, 'base64')
  if (data.length === 0) {
    return textResult('ERROR: dataBase64 is empty or not valid base64')
  }
  if (data.length > MAX_UPLOAD_BYTES) {
    return textResult(
      `ERROR: file too large (${data.length} bytes). Maximum upload size is ${MAX_UPLOAD_BYTES} bytes.`
    )
  }

  const result = await resourcesApi.upload(
    {
      data: new Blob([data]),
      name: args.filename,
      type: args.mimeType ?? 'image/jpeg',
    },
    {
      memoId: args.memoId,
      metadata: args.metadata,
    }
  )
  return jsonResult(result)
}

export const resourcesTools: McpToolDefinition[] = [
  {
    name: 'resources_list',
    title: 'List Resources',
    description: 'List uploaded resources (images, videos) with pagination.',
    inputSchema: listResourcesSchema,
    handler: args => handleListResources(args as Parameters<typeof handleListResources>[0]),
  },
  {
    name: 'resources_get',
    title: 'Get Resource',
    description: 'Get details for a single resource by ID.',
    inputSchema: getResourceSchema,
    handler: args => handleGetResource(args as Parameters<typeof handleGetResource>[0]),
  },
  {
    name: 'resources_upload',
    title: 'Upload Resource',
    description:
      'Upload a file (image/video) as base64 data. Returns the resource with its download URL. Use with memos_create resourceIds or memos_clip for images.',
    inputSchema: uploadResourceSchema,
    handler: args => handleUploadResource(args as Parameters<typeof handleUploadResource>[0]),
  },
]
