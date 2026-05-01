import { useCallback, useMemo, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, View } from 'react-native'
import { DraggableGrid } from 'react-native-draggable-grid'

import { MediaGridTile } from './media/MediaGridTile'
import { MediaPreviewModal } from './media/MediaPreviewModal'
import { getMediaTileSize, resolveMediaSource } from './media/mediaPreviewUtils'
import type { MediaGridItem } from './media/types'
import { useMediaPreviewStore } from '@/stores/mediaPreviewStore'

export type { MediaGridItem } from './media/types'

type GridItem = MediaGridItem

interface DraggableImageGridProps {
  items: MediaGridItem[]
  authHeaders?: Record<string, string>
  uploadProgressById?: Record<string, number>
  onItemsChange?: (items: MediaGridItem[]) => void
  onDragActivate?: () => void
  onDragStart?: () => void
  onDragEnd?: () => void
  draggable?: boolean
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
}: DraggableImageGridProps) {
  const [activePreviewIndex, setActivePreviewIndex] = useState<number | null>(null)
  const [gridWidth, setGridWidth] = useState(0)

  const resolvedItems: MediaGridItem[] = useMemo(() => {
    return items
  }, [items])

  const gridData: GridItem[] = useMemo(
    () =>
      resolvedItems.map(item => ({
        ...item,
      })),
    [resolvedItems]
  )

  const mediaTileSize = getMediaTileSize(resolvedItems.length, gridWidth)
  const originalImageKeys = useMediaPreviewStore(state => state.originalImageKeys)

  const resolvedMediaSources = useMemo(
    () =>
      resolvedItems.map(item => {
        const source = resolveMediaSource(item, authHeaders)
        if (item.type === 'image' && originalImageKeys[source.previewUri]) {
          return { ...source, gridUri: source.previewUri, gridHeaders: source.previewHeaders }
        }
        return source
      }),
    [authHeaders, resolvedItems, originalImageKeys]
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
      const source = resolvedMediaSources[index] ?? resolveMediaSource(item, authHeaders)

      return (
        <View key={`${item.key}_${index}`} style={styles.tileMargin}>
          <MediaGridTile
            item={item}
            width={mediaTileSize.width}
            height={mediaTileSize.height}
            previewUri={source.gridUri}
            previewHeaders={source.gridHeaders}
            uploadProgress={uploadProgressById?.[item.key]}
            isLoading={false}
            onPress={pressable ? () => handleItemPress(index) : undefined}
            onRemove={showRemoveButton ? () => handleRemove(index) : undefined}
            showRemoveButton={showRemoveButton}
          />
        </View>
      )
    },
    [
      authHeaders,
      handleItemPress,
      handleRemove,
      mediaTileSize.height,
      mediaTileSize.width,
      resolvedMediaSources,
      showRemoveButton,
      uploadProgressById,
    ]
  )

  const handleGridLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextWidth = Math.floor(event.nativeEvent.layout.width)
      if (nextWidth > 0 && nextWidth !== gridWidth) {
        setGridWidth(nextWidth)
      }
    },
    [gridWidth]
  )

  return (
    <View style={styles.container} onLayout={handleGridLayout}>
      {draggable ? (
        <DraggableGrid
          key={resolvedItems.length <= 2 ? Math.max(1, resolvedItems.length) : 3}
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
  },
  grid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tileMargin: {
    margin: 0,
  },
})
