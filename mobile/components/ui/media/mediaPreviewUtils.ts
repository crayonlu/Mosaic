import { Dimensions } from 'react-native'

import type { MediaGridItem, ResolvedMediaSource } from './types'

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
  authHeaders?: Record<string, string>
): ResolvedMediaSource {
  const requestHeaders = item.headers ?? authHeaders

  if (item.type === 'image') {
    const thumbUri = getOptimizedMediaUri(item.uri, 'thumb')
    const previewUri = getOptimizedMediaUri(item.uri, 'opt')

    return {
      item,
      gridUri: thumbUri,
      gridHeaders: isRemoteUri(thumbUri) ? requestHeaders : undefined,
      previewUri,
      previewHeaders: isRemoteUri(previewUri) ? requestHeaders : undefined,
    }
  }

  const videoThumbUri = item.thumbnailUri
  const videoOptUri = getOptimizedMediaUri(item.uri, 'opt')

  return {
    item,
    gridUri: videoThumbUri,
    gridHeaders: isRemoteUri(videoThumbUri) ? requestHeaders : undefined,
    previewUri: videoOptUri,
    previewHeaders: isRemoteUri(videoOptUri) ? requestHeaders : undefined,
    previewThumbnailUri: videoThumbUri,
    previewThumbnailHeaders: isRemoteUri(videoThumbUri) ? requestHeaders : undefined,
  }
}
