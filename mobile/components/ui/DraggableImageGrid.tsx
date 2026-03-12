import { useThemeStore } from '@/stores/theme-store'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Play, X } from 'lucide-react-native'
import { useCallback, useMemo, useState } from 'react'
import { Dimensions, Modal, StyleSheet, TouchableOpacity, View } from 'react-native'
import { DraggableGrid } from 'react-native-draggable-grid'
import ImageViewing from 'react-native-image-viewing'
import { SafeAreaView } from 'react-native-safe-area-context'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const GRID_GAP = 0

const getImageSize = (count: number) => {
  const containerWidth = SCREEN_WIDTH - 26
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

interface GridItem {
  key: string
  uri: string
  type: 'image' | 'video'
  thumbnailUri?: string
  headers?: Record<string, string>
}

export interface MediaGridItem {
  key: string
  uri: string
  type: 'image' | 'video'
  thumbnailUri?: string
  headers?: Record<string, string>
}

interface DraggableImageGridProps {
  items?: MediaGridItem[]
  images?: string[]
  authHeaders?: Record<string, string>
  onImagesChange?: (images: string[]) => void
  onItemsChange?: (items: MediaGridItem[]) => void
  maxImages?: number
  onAddImage?: () => void
  draggable?: boolean
  onRemove?: (index: number) => void
  onImagePress?: (index: number) => void
}

export function DraggableImageGrid({
  items,
  images = [],
  authHeaders,
  onImagesChange,
  onItemsChange,
  maxImages = 9,
  onAddImage,
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

      return (
        <View style={[styles.imageWrapper, { width: imageSize.width, height: imageSize.height }]}>
          <View style={styles.imageContainer}>
            <TouchableOpacity
              style={styles.imageContainer}
              onPress={() => handleImagePress(index)}
              activeOpacity={0.9}
            >
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
            </TouchableOpacity>
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
      handleImagePress,
      handleRemove,
      imageSize,
      onImagesChange,
      onItemsChange,
      onRemove,
      theme,
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
        numColumns={resolvedItems.length <= 2 ? resolvedItems.length : 3}
        data={gridData}
        renderItem={renderItem}
        onItemPress={(item: GridItem) => {
          const index = resolvedItems.findIndex(candidate => candidate.key === item.key)
          if (index >= 0) {
            handleImagePress(index)
          }
        }}
        onDragRelease={handleDragRelease}
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
  const player = useVideoPlayer(
    {
      uri: item.uri,
      headers: item.headers ?? authHeaders,
    },
    player => {
      player.loop = false
    }
  )

  return (
    <Modal visible={true} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.videoModal} edges={['top', 'right', 'bottom', 'left']}>
        <TouchableOpacity style={styles.videoCloseButton} onPress={onClose}>
          <X size={20} color="#fff" />
        </TouchableOpacity>
        <VideoView
          player={player}
          style={styles.videoPlayer}
          nativeControls
          allowsFullscreen
          contentFit="contain"
        />
      </SafeAreaView>
    </Modal>
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
  videoModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.96)',
    justifyContent: 'center',
  },
  videoCloseButton: {
    position: 'absolute',
    top: 24,
    right: 20,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayer: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
})
