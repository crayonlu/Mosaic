import type { MediaGridItem } from '@/components/ui/DraggableImageGrid'
import {
  uploadResourceFiles,
  type NativeUploadFile,
  type ResourceMetadata,
  type ResourceResponse,
  type UploadProgress,
} from '@mosaic/api'
import type { ImagePickerAsset } from 'expo-image-picker'
import { getThumbnailAsync } from 'expo-video-thumbnails'

export interface SelectedMediaItem extends MediaGridItem {
  filename: string
  mimeType: string
  fileSize?: number
  metadata?: ResourceMetadata
}

interface UploadSelectedMediaOptions {
  memoId?: string
  onFileStart?: (item: SelectedMediaItem) => void
  onFileProgress?: (item: SelectedMediaItem, progress: UploadProgress) => void
  onFileComplete?: (item: SelectedMediaItem, resource: ResourceResponse) => void
  onFileError?: (item: SelectedMediaItem, error: unknown) => void
}

function getAssetType(asset: ImagePickerAsset): 'image' | 'video' {
  if (asset.type === 'video' || asset.mimeType?.startsWith('video/')) {
    return 'video'
  }

  return 'image'
}

function buildFilename(asset: ImagePickerAsset, type: 'image' | 'video'): string {
  if (asset.fileName) {
    return asset.fileName
  }

  const extension = type === 'video' ? 'mp4' : 'jpg'
  return `${type}_${Date.now()}.${extension}`
}

function buildMimeType(asset: ImagePickerAsset, type: 'image' | 'video'): string {
  if (asset.mimeType) {
    return asset.mimeType
  }

  return type === 'video' ? 'video/mp4' : 'image/jpeg'
}

async function getVideoThumbnailUri(
  asset: ImagePickerAsset,
  durationMs?: number
): Promise<string | undefined> {
  try {
    const targetTime = durationMs ? Math.min(Math.max(durationMs / 2, 250), 1500) : 1000
    const thumbnail = await getThumbnailAsync(asset.uri, { time: Math.round(targetTime) })
    return thumbnail.uri
  } catch {
    return undefined
  }
}

export async function createSelectedMediaItems(
  assets: ImagePickerAsset[]
): Promise<SelectedMediaItem[]> {
  return Promise.all(
    assets.map(async asset => {
      const type = getAssetType(asset)
      const filename = buildFilename(asset, type)
      const mimeType = buildMimeType(asset, type)
      const durationMs = asset.duration ?? undefined
      const thumbnailUri =
        type === 'video' ? await getVideoThumbnailUri(asset, durationMs) : undefined

      return {
        key: asset.assetId ?? `${filename}-${asset.uri}`,
        uri: asset.uri,
        type,
        thumbnailUri,
        filename,
        mimeType,
        fileSize: asset.fileSize ?? undefined,
        metadata: {
          width: asset.width,
          height: asset.height,
          durationMs,
          thumbnailTimeMs: durationMs ? Math.min(Math.max(durationMs / 2, 250), 1500) : undefined,
        },
      }
    })
  )
}

export async function uploadSelectedMedia(
  items: SelectedMediaItem[],
  options: UploadSelectedMediaOptions = {}
): Promise<ResourceResponse[]> {
  const itemsById = new Map(items.map(item => [item.key, item]))
  const metadataByUri = new Map(items.map(item => [item.uri, item.metadata]))

  const entries = items.map(item => ({
    id: item.key,
    file: {
      uri: item.uri,
      name: item.filename,
      type: item.mimeType,
      size: item.fileSize,
    } satisfies NativeUploadFile,
  }))

  return uploadResourceFiles(entries, {
    memoId: options.memoId,
    resolveMetadata: file => metadataByUri.get(file.uri),
    onFileStart: entry => {
      const item = itemsById.get(entry.id)
      if (item) {
        options.onFileStart?.(item)
      }
    },
    onFileProgress: (entry, progress) => {
      const item = itemsById.get(entry.id)
      if (item) {
        options.onFileProgress?.(item, progress)
      }
    },
    onFileComplete: (entry, resource) => {
      const item = itemsById.get(entry.id)
      if (item) {
        options.onFileComplete?.(item, resource)
      }
    },
    onFileError: (entry, error) => {
      const item = itemsById.get(entry.id)
      if (item) {
        options.onFileError?.(item, error)
      }
    },
  })
}
