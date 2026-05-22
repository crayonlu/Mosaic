import type { MediaGridItem } from '@/components/ui/DraggableImageGrid'
import {
  uploadResourceFiles,
  type NativeUploadFile,
  type ResourceMetadata,
  type ResourceResponse,
  type UploadProgress,
} from '@mosaic/api'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImageManipulator from 'expo-image-manipulator'
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

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function getFilenameExtension(filename: string, fallbackType: 'image' | 'video'): string {
  const extensionIndex = filename.lastIndexOf('.')
  if (extensionIndex >= 0 && extensionIndex < filename.length - 1) {
    return filename.slice(extensionIndex + 1)
  }

  return fallbackType === 'video' ? 'mp4' : 'jpg'
}

async function resolveUploadUri(item: SelectedMediaItem): Promise<string> {
  if (item.type !== 'video' || item.uri.startsWith('file://')) {
    return item.uri
  }

  const cacheDirectory = FileSystem.cacheDirectory
  if (!cacheDirectory) {
    throw new Error('Cache directory is unavailable for media upload')
  }

  const sourceInfo = await FileSystem.getInfoAsync(item.uri)
  if (!sourceInfo.exists) {
    throw new Error('Selected video is no longer available for upload')
  }

  const uploadDirectory = `${cacheDirectory}mosaic-upload-cache/`
  await FileSystem.makeDirectoryAsync(uploadDirectory, { intermediates: true })

  const extension = getFilenameExtension(item.filename, item.type)
  const destinationUri = `${uploadDirectory}${sanitizeFilenamePart(item.key)}-${Date.now()}.${extension}`

  await FileSystem.copyAsync({ from: item.uri, to: destinationUri })
  return destinationUri
}

async function compressImageForUpload(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 2048 } }], {
    compress: 0.82,
    format: ImageManipulator.SaveFormat.JPEG,
  })
  return result.uri
}

async function createNativeUploadFile(item: SelectedMediaItem): Promise<NativeUploadFile> {
  let uri = await resolveUploadUri(item)

  if (item.type === 'image') {
    uri = await compressImageForUpload(uri)
  }

  return {
    uri,
    name: item.filename,
    type: item.mimeType,
    size: item.fileSize,
  }
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
  // Process sequentially to avoid OOM from simultaneous video decoding
  const results: SelectedMediaItem[] = []
  for (const asset of assets) {
    const type = getAssetType(asset)
    const filename = buildFilename(asset, type)
    const mimeType = buildMimeType(asset, type)
    const durationMs = asset.duration ?? undefined
    const thumbnailUri =
      type === 'video' ? await getVideoThumbnailUri(asset, durationMs) : undefined

    results.push({
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
    })
  }
  return results
}

export async function uploadSelectedMedia(
  items: SelectedMediaItem[],
  options: UploadSelectedMediaOptions = {}
): Promise<ResourceResponse[]> {
  const itemsById = new Map(items.map(item => [item.key, item]))
  const metadataById = new Map(items.map(item => [item.key, item.metadata]))

  const entries = await Promise.all(
    items.map(async item => ({
      id: item.key,
      file: await createNativeUploadFile(item).catch(error => {
        const message = error instanceof Error ? error.message : 'Unknown media preparation error'
        throw new Error(
          `Failed to prepare media upload for ${item.filename} (${item.uri}): ${message}`
        )
      }),
    }))
  )

  // Track temp URIs for cleanup
  const tempUris = entries
    .map(entry => entry.file.uri)
    .filter(uri => uri.includes('mosaic-upload-cache/'))

  try {
    return await uploadResourceFiles(entries, {
      memoId: options.memoId,
      resolveMetadata: (_file, entry) => metadataById.get(entry.id),
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
  } finally {
    // Clean up temp files from mosaic-upload-cache
    for (const tempUri of tempUris) {
      FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {})
    }
  }
}
