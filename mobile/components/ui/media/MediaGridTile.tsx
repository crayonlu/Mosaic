import { useThemeStore } from '@/stores/themeStore'
import { Image } from 'expo-image'
import { ImageOff, Play, VideoOff, X } from 'lucide-react-native'
import { Pressable, StyleSheet, TouchableOpacity, View } from 'react-native'
import { useState } from 'react'

import { withAlpha } from './mediaPreviewUtils'
import type { MediaGridItem } from './types'

interface MediaGridTileProps {
  item: MediaGridItem
  width: number
  height: number
  previewUri?: string
  previewHeaders?: Record<string, string>
  uploadProgress?: number
  isLoading?: boolean
  onPress?: () => void
  onRemove?: () => void
  showRemoveButton?: boolean
}

export function MediaGridTile({
  item,
  width,
  height,
  previewUri,
  previewHeaders,
  uploadProgress,
  isLoading = false,
  onPress,
  onRemove,
  showRemoveButton = false,
}: MediaGridTileProps) {
  const { theme } = useThemeStore()
  const [imageError, setImageError] = useState(false)
  const uploadOverlayColor = withAlpha(theme.background, 0.14)
  const progressTrackColor = withAlpha(theme.surface, 0.9)
  const videoBadgeColor = withAlpha(theme.background, 0.7)
  const videoBadgeIconColor = withAlpha(theme.text, 0.98)
  const loadingBgColor = withAlpha(theme.surface, 0.9)
  const isUploading = typeof uploadProgress === 'number'

  const content = (
    <View style={styles.imageContainer}>
      {isLoading ? (
        <View style={[styles.loadingContainer, { backgroundColor: loadingBgColor }]}>
          <View style={[styles.loadingDot, { backgroundColor: theme.textSecondary }]} />
          <View style={[styles.loadingDot, { backgroundColor: theme.textSecondary }]} />
          <View style={[styles.loadingDot, { backgroundColor: theme.textSecondary }]} />
        </View>
      ) : previewUri && !imageError ? (
        <Image
          source={{ uri: previewUri, headers: previewHeaders }}
          style={styles.image}
          contentFit="cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <View style={[styles.errorFallback, { backgroundColor: theme.surface }]}>
          {item.type === 'image' ? (
            <ImageOff size={24} color={theme.textSecondary} />
          ) : (
            <VideoOff size={24} color={theme.textSecondary} />
          )}
        </View>
      )}

      {item.type === 'video' && (
        <View style={[styles.videoBadge, { backgroundColor: videoBadgeColor }]}>
          <Play size={14} color={videoBadgeIconColor} fill={videoBadgeIconColor} />
        </View>
      )}

      {isUploading && (
        <>
          <View
            style={[styles.uploadOverlay, { backgroundColor: uploadOverlayColor }]}
            pointerEvents="none"
          />
          <View
            style={[styles.progressTrack, { backgroundColor: progressTrackColor }]}
            pointerEvents="none"
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: theme.primary,
                  width: `${Math.max(6, Math.min(uploadProgress, 100))}%`,
                },
              ]}
            />
          </View>
        </>
      )}
    </View>
  )

  return (
    <View style={[styles.wrapper, { width, height }]}>
      {onPress ? (
        <Pressable style={styles.pressable} onPress={onPress}>
          {content}
        </Pressable>
      ) : (
        content
      )}

      {showRemoveButton && onRemove ? (
        <TouchableOpacity
          style={[styles.removeButton, { backgroundColor: theme.background }]}
          onPress={onRemove}
        >
          <X size={14} color={theme.text} />
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    overflow: 'hidden',
  },
  pressable: {
    flex: 1,
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
  },
  progressTrack: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 6,
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
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
  },
  errorFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  videoBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
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
