import { apiClient } from '@mosaic/api'

export async function loadAuthResource(url: string): Promise<{
  blobUrl: string
  type: 'image' | 'video'
  blob: Blob
}> {
  const token = await apiClient.getTokenStorage()?.getAccessToken()
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!response.ok) {
    throw new Error(`Failed to load resource: ${response.status}`)
  }

  const blob = await response.blob()
  const isVideo = blob.type.startsWith('video/')
  const blobUrl = URL.createObjectURL(blob)

  return {
    blobUrl,
    type: isVideo ? 'video' : 'image',
    blob,
  }
}

export function isBypassSource(url: string): boolean {
  return url.startsWith('blob:') || url.startsWith('data:')
}
