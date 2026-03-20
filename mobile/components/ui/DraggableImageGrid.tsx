import { apiClient } from '@mosaic/api'
import { useResourceCache } from '@mosaic/cache'
import { useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { DraggableGrid } from 'react-native-draggable-grid'

import { MediaGridTile } from './media/MediaGridTile'
import { MediaPreviewModal } from './media/MediaPreviewModal'
import {
  getMediaTileSize,
  getOptimizedMediaUri,
  resolveMediaSource,
} from './media/mediaPreviewUtils'
import type { MediaCacheMaps, MediaGridItem } from './media/types'

export type { MediaGridItem } from './media/types'

type GridItem = MediaGridItem

function toAbsoluteUrl(url?: string): string | undefined {
  if (!url) return undefined
  if (/^https?:/i.test(url)) return url
  const baseUrl = apiClient.getBaseUrl()
  return baseUrl ? `${baseUrl}${url}` : url
}

interface DraggableImageGridProps {
  items: MediaGridItem[]
  authHeaders?: Record<string, string>
  uploadProgressById?: Record<string, number>
  onItemsChange?: (items: MediaGridItem[]) => void
  onDragActivate?: () => void
  onDragStart?: () => void
  onDragEnd?: () => void
  draggable?: boolean
  isCacheLoading?: boolean
}

export function DraggableImageGrid({
  items,
  authHeaders,
  uploadProgressById,
  onItemsChange,
  onDragActivate,
  onDragStart,
  onDragEnd,
  draggable = true,
  isCacheLoading = false,
}: DraggableImageGridProps) {
  const [activePreviewIndex, setActivePreviewIndex] = useState<number | null>(null)

  const resolvedItems: MediaGridItem[] = useMemo(() => items, [items])

  const imageThumbUrls = useMemo(() => {
    const urls: string[] = []
    for (const item of resolvedItems) {
      if (item.type === 'image') {
        const url = toAbsoluteUrl(getOptimizedMediaUri(item.uri, 'thumb'))
        if (url) urls.push(url)
      }
    }
    return urls
  }, [resolvedItems])

  const imageOptUrls = useMemo(() => {
    const urls: string[] = []
    for (const item of resolvedItems) {
      if (item.type === 'image') {
        const url = toAbsoluteUrl(getOptimizedMediaUri(item.uri, 'opt'))
        if (url) urls.push(url)
      }
    }
    return urls
  }, [resolvedItems])

  const videoThumbUrls = useMemo(() => {
    const urls: string[] = []
    for (const item of resolvedItems) {
      if (item.type === 'video' && item.thumbnailUri) {
        const url = toAbsoluteUrl(item.thumbnailUri)
        if (url) urls.push(url)
      }
    }
    return urls
  }, [resolvedItems])

  const videoOptUrls = useMemo(() => {
    const urls: string[] = []
    for (const item of resolvedItems) {
      if (item.type === 'video') {
        const url = toAbsoluteUrl(getOptimizedMediaUri(item.uri, 'opt'))
        if (url) urls.push(url)
      }
    }
    return urls
  }, [resolvedItems])

  const { cachedUris: cachedImageThumbUris, isLoading: isLoadingImageThumb } =
    useResourceCache(imageThumbUrls)
  const { cachedUris: cachedImageOptUris, isLoading: isLoadingImageOpt } =
    useResourceCache(imageOptUrls)
  const { cachedUris: cachedVideoThumbUris, isLoading: isLoadingVideoThumb } =
    useResourceCache(videoThumbUrls)
  const { cachedUris: cachedVideoOptUris, isLoading: isLoadingVideoOpt } =
    useResourceCache(videoOptUrls)

  const isResourceCacheLoading =
    isLoadingImageThumb || isLoadingImageOpt || isLoadingVideoThumb || isLoadingVideoOpt
  const showLoading = isCacheLoading || isResourceCacheLoading

  const cacheMaps = useMemo<MediaCacheMaps>(
    () => ({
      imageThumbUris: cachedImageThumbUris,
      imageOptUris: cachedImageOptUris,
      videoThumbUris: cachedVideoThumbUris,
      videoOptUris: cachedVideoOptUris,
    }),
    [cachedImageOptUris, cachedImageThumbUris, cachedVideoOptUris, cachedVideoThumbUris]
  )

  const gridData: GridItem[] = useMemo(
    () =>
      resolvedItems.map(item => ({
        ...item,
      })),
    [resolvedItems]
  )

  const mediaTileSize = getMediaTileSize(resolvedItems.length)
  const resolvedMediaSources = useMemo(
    () => resolvedItems.map(item => resolveMediaSource(item, cacheMaps, authHeaders)),
    [authHeaders, cacheMaps, resolvedItems]
  )
  const showRemoveButton = Boolean(onItemsChange)

  const handleDragRelease = useCallback(
    (data: GridItem[]) => {
      if (onItemsChange) {
        onItemsChange(data)
      }
    },
    [onItemsChange]
  )

  const handleRemove = useCallback(
    (index: number) => {
      if (onItemsChange) {
        onItemsChange(resolvedItems.filter((_, itemIndex) => itemIndex !== index))
      }
    },
    [onItemsChange, resolvedItems]
  )

  const handleItemPress = useCallback(
    (index: number) => {
      if (resolvedMediaSources[index]) {
        setActivePreviewIndex(index)
      }
    },
    [resolvedMediaSources]
  )

  const renderGridItem = useCallback(
    (item: GridItem, index: number, pressable: boolean) => {
      const source = resolvedMediaSources[index] ?? resolveMediaSource(item, cacheMaps, authHeaders)

      return (
        <View key={`${item.key}_${index}`} style={styles.tileMargin}>
          <MediaGridTile
            item={item}
            width={mediaTileSize.width}
            height={mediaTileSize.height}
            previewUri={source.gridUri}
            previewHeaders={source.gridHeaders}
            uploadProgress={uploadProgressById?.[item.key]}
            isLoading={showLoading}
            onPress={pressable ? () => handleItemPress(index) : undefined}
            onRemove={showRemoveButton ? () => handleRemove(index) : undefined}
            showRemoveButton={showRemoveButton}
          />
        </View>
      )
    },
    [
      authHeaders,
      cacheMaps,
      handleItemPress,
      handleRemove,
      mediaTileSize.height,
      mediaTileSize.width,
      resolvedMediaSources,
      showLoading,
      showRemoveButton,
      uploadProgressById,
    ]
  )

  return (
    <View style={styles.container}>
      {draggable ? (
        <DraggableGrid
          numColumns={resolvedItems.length <= 2 ? Math.max(1, resolvedItems.length) : 3}
          data={gridData}
          renderItem={(item: GridItem, order: number) => renderGridItem(item, order, false)}
          delayLongPress={220}
          onDragItemActive={() => {
            onDragActivate?.()
          }}
          onDragStart={() => {
            onDragStart?.()
          }}
          onItemPress={(item: GridItem) => {
            const index = resolvedItems.findIndex(candidate => candidate.key === item.key)
            if (index >= 0) {
              handleItemPress(index)
            }
          }}
          onDragRelease={data => {
            handleDragRelease(data)
            onDragEnd?.()
          }}
          style={styles.grid}
        />
      ) : (
        <View style={styles.grid}>
          {resolvedItems.map((item, index) => renderGridItem(item, index, true))}
        </View>
      )}

      {activePreviewIndex !== null ? (
        <MediaPreviewModal
          items={resolvedMediaSources}
          initialIndex={activePreviewIndex}
          onRequestClose={() => setActivePreviewIndex(null)}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tileMargin: {
    margin: 0,
  },
})
