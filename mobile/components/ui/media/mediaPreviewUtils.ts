import { File } from 'expo-file-system'
import { Dimensions } from 'react-native'

import type { MediaCacheMaps, MediaGridItem, ResolvedMediaSource } from './types'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const GRID_GAP = 0

export function getMediaTileSize(count: number, measuredContainerWidth?: number) {
  const safeMeasuredWidth =
    typeof measuredContainerWidth === 'number' && measuredContainerWidth > 0
      ? measuredContainerWidth
      : undefined
  const containerWidth = safeMeasuredWidth ?? SCREEN_WIDTH - 24
  if (count === 1) {
    return { width: containerWidth, height: 300 }
  }
  if (count === 2) {
    const size = (containerWidth - GRID_GAP) / 2
    return { width: size, height: 150 }
  }
  const size = (containerWidth - GRID_GAP * 2) / 3
  return { width: size, height: size }
}

export function getOptimizedMediaUri(uri: string, variant?: 'thumb' | 'opt'): string {
  if (!variant) return uri
  const separator = uri.includes('?') ? '&' : '?'
  return `${uri}${separator}variant=${variant}`
}

export function isRemoteUri(uri?: string): uri is string {
  return typeof uri === 'string' && /^https?:/i.test(uri)
}

export function resolveCachedUri(originalUri?: string, cachedUri?: string): string | undefined {
  if (!cachedUri) {
    return originalUri
  }

  if (!/^file:/i.test(cachedUri)) {
    return cachedUri
  }

  try {
    return new File(cachedUri).exists ? cachedUri : originalUri
  } catch {
    return originalUri
  }
}

export function withAlpha(color: string, alpha: number): string {
  const normalizedAlpha = Math.max(0, Math.min(alpha, 1))

  if (color.startsWith('#')) {
    let hex = color.slice(1)
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map(char => char + char)
        .join('')
    }

    if (hex.length === 6) {
      const red = parseInt(hex.slice(0, 2), 16)
      const green = parseInt(hex.slice(2, 4), 16)
      const blue = parseInt(hex.slice(4, 6), 16)
      return `rgba(${red}, ${green}, ${blue}, ${normalizedAlpha})`
    }
  }

  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${normalizedAlpha})`)
  }

  if (color.startsWith('rgba(')) {
    return color.replace(/,\s*[\d.]+\)$/, `, ${normalizedAlpha})`)
  }

  return color
}

export function safelyControlPlayer(action: () => void): void {
  try {
    action()
  } catch (error) {
    console.warn('Video player control skipped:', error)
  }
}

export function formatPlaybackTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
  const mins = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function resolveMediaSource(
  item: MediaGridItem,
  cacheMaps: MediaCacheMaps,
  authHeaders?: Record<string, string>
): ResolvedMediaSource {
  const requestHeaders = item.headers ?? authHeaders

  if (item.type === 'image') {
    const thumbUri = getOptimizedMediaUri(item.uri, 'thumb')
    const previewUri = getOptimizedMediaUri(item.uri, 'opt')
    const cachedThumbUri = cacheMaps.imageThumbUris[thumbUri]
    const cachedPreviewUri = cacheMaps.imageOptUris[previewUri]
    const resolvedThumbUri = resolveCachedUri(thumbUri, cachedThumbUri) || thumbUri
    const resolvedPreviewUri = resolveCachedUri(previewUri, cachedPreviewUri) || previewUri

    return {
      item,
      gridUri: resolvedThumbUri,
      gridHeaders: isRemoteUri(resolvedThumbUri) ? requestHeaders : undefined,
      previewUri: resolvedPreviewUri,
      previewHeaders: isRemoteUri(resolvedPreviewUri) ? requestHeaders : undefined,
    }
  }

  const videoThumbUri = item.thumbnailUri
  const cachedVideoThumbUri = item.thumbnailUri
    ? cacheMaps.videoThumbUris[item.thumbnailUri]
    : undefined
  const resolvedVideoThumbUri =
    resolveCachedUri(videoThumbUri, cachedVideoThumbUri) || videoThumbUri
  const videoOptUri = getOptimizedMediaUri(item.uri, 'opt')
  const cachedVideoOptUri = cacheMaps.videoOptUris[videoOptUri]
  const resolvedVideoUri = resolveCachedUri(videoOptUri, cachedVideoOptUri) || videoOptUri

  return {
    item,
    gridUri: resolvedVideoThumbUri,
    gridHeaders: isRemoteUri(resolvedVideoThumbUri) ? requestHeaders : undefined,
    previewUri: resolvedVideoUri,
    previewHeaders: isRemoteUri(resolvedVideoUri) ? requestHeaders : undefined,
    previewThumbnailUri: resolvedVideoThumbUri,
    previewThumbnailHeaders: isRemoteUri(resolvedVideoThumbUri) ? requestHeaders : undefined,
  }
}
