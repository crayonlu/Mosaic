import { useThemeStore } from '@/stores/themeStore'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Play, X } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native'
import { DraggableGrid } from 'react-native-draggable-grid'
import ImageViewing from 'react-native-image-viewing'
import { SafeAreaView } from 'react-native-safe-area-context'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const GRID_GAP = 0

const getImageSize = (count: number) => {
  const containerWidth = SCREEN_WIDTH - 24
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

export interface MediaGridItem {
  key: string
  uri: string
  type: 'image' | 'video'
  thumbnailUri?: string
  headers?: Record<string, string>
}

type GridItem = MediaGridItem

interface DraggableImageGridProps {
  items?: MediaGridItem[]
  images?: string[]
  authHeaders?: Record<string, string>
  uploadProgressById?: Record<string, number>
  onImagesChange?: (images: string[]) => void
  onItemsChange?: (items: MediaGridItem[]) => void
  onDragActivate?: () => void
  onDragStart?: () => void
  onDragEnd?: () => void
  draggable?: boolean
  onRemove?: (index: number) => void
  onImagePress?: (index: number) => void
}

export function DraggableImageGrid({
  items,
  images = [],
  authHeaders,
  uploadProgressById,
  onImagesChange,
  onItemsChange,
  onDragActivate,
  onDragStart,
  onDragEnd,
  draggable = true,
  onRemove,
  onImagePress,
}: DraggableImageGridProps) {
  const { theme } = useThemeStore()
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [videoPreviewItem, setVideoPreviewItem] = useState<MediaGridItem | null>(null)

  const resolvedItems: MediaGridItem[] = useMemo(
    () =>
      items ??
      images.map(uri => ({
        key: `img_${uri}`,
        uri,
        type: 'image' as const,
      })),
    [images, items]
  )

  const gridData: GridItem[] = useMemo(
    () =>
      resolvedItems.map(item => ({
        ...item,
      })),
    [resolvedItems]
  )

  const imageSize = getImageSize(resolvedItems.length)
  const imageImages = useMemo(
    () =>
      resolvedItems
        .filter(item => item.type === 'image')
        .map(item => ({ uri: item.uri, headers: item.headers ?? authHeaders })),
    [resolvedItems, authHeaders]
  )

  const handleDragRelease = useCallback(
    (data: GridItem[]) => {
      if (onItemsChange) {
        onItemsChange(data)
      }

      if (onImagesChange && data.every(item => item.type === 'image')) {
        onImagesChange(data.map(item => item.uri))
      }
    },
    [onImagesChange, onItemsChange]
  )

  const handleRemove = useCallback(
    (index: number) => {
      if (onItemsChange) {
        onItemsChange(resolvedItems.filter((_, itemIndex) => itemIndex !== index))
      } else if (onImagesChange) {
        onImagesChange(
          resolvedItems.filter((_, itemIndex) => itemIndex !== index).map(item => item.uri)
        )
      } else if (onRemove) {
        onRemove(index)
      }
    },
    [onImagesChange, onItemsChange, onRemove, resolvedItems]
  )

  const handleImagePress = useCallback(
    (index: number) => {
      if (onImagePress) {
        onImagePress(index)
        return
      }

      const item = resolvedItems[index]
      if (!item) {
        return
      }

      if (item.type === 'video') {
        setVideoPreviewItem(item)
      } else {
        const imageIndex = resolvedItems
          .filter(candidate => candidate.type === 'image')
          .findIndex(candidate => candidate.key === item.key)

        if (imageIndex >= 0) {
          setPreviewIndex(imageIndex)
        }
      }
    },
    [onImagePress, resolvedItems]
  )

  const renderItem = useCallback(
    (item: GridItem, order: number) => {
      const index = order
      const previewUri = item.type === 'video' ? item.thumbnailUri : item.uri
      const progress = uploadProgressById?.[item.key]
      const isUploading = typeof progress === 'number'

      return (
        <View style={[styles.imageWrapper, { width: imageSize.width, height: imageSize.height }]}>
          <View style={styles.imageContainer}>
            <View style={styles.imageContainer}>
              {previewUri ? (
                <Image
                  source={{ uri: previewUri, headers: item.headers ?? authHeaders }}
                  style={styles.image}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    styles.videoFallback,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Play size={20} color={theme.textSecondary} fill={theme.textSecondary} />
                </View>
              )}
              {item.type === 'video' && (
                <View style={styles.videoBadge}>
                  <Play size={14} color="#fff" fill="#fff" />
                </View>
              )}
              {isUploading && <View style={styles.uploadOverlay} pointerEvents="none" />}
              {isUploading && (
                <View style={styles.progressTrack} pointerEvents="none">
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: theme.primary,
                        width: `${Math.max(6, Math.min(progress, 100))}%`,
                      },
                    ]}
                  />
                </View>
              )}
            </View>
          </View>
          {(onRemove || onImagesChange || onItemsChange) && (
            <TouchableOpacity
              style={[styles.removeButton, { backgroundColor: theme.background }]}
              onPress={() => handleRemove(index)}
            >
              <X size={14} color={theme.text} />
            </TouchableOpacity>
          )}
        </View>
      )
    },
    [
      authHeaders,
      handleRemove,
      imageSize,
      onImagesChange,
      onItemsChange,
      onRemove,
      theme,
      uploadProgressById,
    ]
  )

  if (!draggable) {
    return (
      <View style={styles.container}>
        <View style={styles.grid}>
          {resolvedItems.map((item, index) => (
            <View
              key={item.key}
              style={[styles.imageWrapper, { width: imageSize.width, height: imageSize.height }]}
            >
              <TouchableOpacity
                style={styles.imageContainer}
                onPress={() => handleImagePress(index)}
                activeOpacity={0.9}
              >
                {item.type === 'video' && !item.thumbnailUri ? (
                  <View
                    style={[
                      styles.videoFallback,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                  >
                    <Play size={24} color={theme.textSecondary} fill={theme.textSecondary} />
                  </View>
                ) : (
                  <Image
                    source={{
                      uri: item.thumbnailUri ?? item.uri,
                      headers: item.headers ?? authHeaders,
                    }}
                    style={styles.image}
                    contentFit="cover"
                  />
                )}
                {item.type === 'video' && (
                  <View style={styles.videoBadge}>
                    <Play size={14} color="#fff" fill="#fff" />
                  </View>
                )}
                {typeof uploadProgressById?.[item.key] === 'number' && (
                  <View style={styles.uploadOverlay} pointerEvents="none" />
                )}
                {typeof uploadProgressById?.[item.key] === 'number' && (
                  <View style={styles.progressTrack} pointerEvents="none">
                    <View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: theme.primary,
                          width: `${Math.max(6, Math.min(uploadProgressById[item.key] ?? 0, 100))}%`,
                        },
                      ]}
                    />
                  </View>
                )}
              </TouchableOpacity>
              {(onRemove || onItemsChange || onImagesChange) && (
                <TouchableOpacity
                  style={[styles.removeButton, { backgroundColor: theme.background }]}
                  onPress={() => handleRemove(index)}
                >
                  <X size={14} color={theme.text} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {previewIndex !== null && (
          <SafeAreaView style={StyleSheet.absoluteFill} edges={['top', 'right', 'bottom', 'left']}>
            <ImageViewing
              images={imageImages}
              imageIndex={previewIndex}
              visible={true}
              onRequestClose={() => setPreviewIndex(null)}
              presentationStyle="fullScreen"
            />
          </SafeAreaView>
        )}

        <VideoPreviewModal
          item={videoPreviewItem}
          authHeaders={authHeaders}
          onClose={() => setVideoPreviewItem(null)}
        />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <DraggableGrid
        numColumns={resolvedItems.length <= 2 ? Math.max(1, resolvedItems.length) : 3}
        data={gridData}
        renderItem={renderItem}
        delayLongPress={220}
        onDragItemActive={(item: GridItem) => {
          onDragActivate?.()
        }}
        onDragStart={(item: GridItem) => {
          onDragStart?.()
        }}
        onItemPress={(item: GridItem) => {
          const index = resolvedItems.findIndex(candidate => candidate.key === item.key)
          if (index >= 0) {
            handleImagePress(index)
          }
        }}
        onDragRelease={data => {
          handleDragRelease(data)
          onDragEnd?.()
        }}
        style={styles.grid}
      />

      {previewIndex !== null && (
        <SafeAreaView style={StyleSheet.absoluteFill} edges={['top', 'right', 'bottom', 'left']}>
          <ImageViewing
            images={imageImages}
            imageIndex={previewIndex}
            visible={true}
            onRequestClose={() => setPreviewIndex(null)}
            presentationStyle="fullScreen"
          />
        </SafeAreaView>
      )}

      <VideoPreviewModal
        item={videoPreviewItem}
        authHeaders={authHeaders}
        onClose={() => setVideoPreviewItem(null)}
      />
    </View>
  )
}

function VideoPreviewModal({
  item,
  authHeaders,
  onClose,
}: {
  item: MediaGridItem | null
  authHeaders?: Record<string, string>
  onClose: () => void
}) {
  if (!item) {
    return null
  }

  return <ActiveVideoPreview item={item} authHeaders={authHeaders} onClose={onClose} />
}

function ActiveVideoPreview({
  item,
  authHeaders,
  onClose,
}: {
  item: MediaGridItem
  authHeaders?: Record<string, string>
  onClose: () => void
}) {
  const videoViewRef = useRef<VideoView>(null)

  const player = useVideoPlayer(
    {
      uri: item.uri,
      headers: item.headers ?? authHeaders,
    },
    player => {
      player.loop = false
      player.play()
    }
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      videoViewRef.current?.enterFullscreen()
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView
        ref={videoViewRef}
        player={player}
        style={[StyleSheet.absoluteFill, { opacity: 0 }]}
        onFullscreenExit={onClose}
      />
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
  imageWrapper: {
    margin: GRID_GAP / 2,
    position: 'relative',
    overflow: 'hidden',
  },
  imageContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  progressTrack: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 6,
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  videoFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  videoBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
