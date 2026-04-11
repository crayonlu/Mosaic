import { useThemeStore } from '@/stores/themeStore'
import { X } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ImagePreviewContent } from './ImagePreviewContent'
import { withAlpha } from './mediaPreviewUtils'
import type { ResolvedMediaSource } from './types'
import { VideoPreviewContent } from './VideoPreviewContent'

interface MediaPreviewModalProps {
  items: ResolvedMediaSource[]
  initialIndex: number
  onRequestClose: () => void
}

export function MediaPreviewModal({ items, initialIndex, onRequestClose }: MediaPreviewModalProps) {
  const { theme } = useThemeStore()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const listRef = useRef<FlatList<ResolvedMediaSource>>(null)
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const overlayColor = useMemo(() => withAlpha(theme.background, 0.96), [theme.background])
  const closeButtonColor = useMemo(() => withAlpha(theme.surface, 0.82), [theme.surface])
  const closeButtonPressedColor = useMemo(() => withAlpha(theme.surface, 0.96), [theme.surface])
  const counterBackgroundColor = useMemo(() => withAlpha(theme.surface, 0.7), [theme.surface])

  useEffect(() => {
    setCurrentIndex(initialIndex)
  }, [initialIndex])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToIndex({ index: initialIndex, animated: false })
    }
  }, [initialIndex, width])

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width)
      setCurrentIndex(Math.max(0, Math.min(nextIndex, items.length - 1)))
    },
    [items.length, width]
  )

  return (
    <Modal
      visible={items.length > 0}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <View style={[styles.container, { backgroundColor: overlayColor }]}>
        <FlatList
          ref={listRef}
          data={items}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          keyExtractor={item => item.item.key}
          scrollEnabled={items.length > 1}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          renderItem={({ item, index }) => (
            <View style={[styles.page, { width }]}>
              {item.item.type === 'image' ? (
                <ImagePreviewContent
                  uri={item.previewUri}
                  headers={item.previewHeaders}
                  isActive={index === currentIndex}
                />
              ) : (
                <VideoPreviewContent
                  uri={item.previewUri}
                  headers={item.previewHeaders}
                  thumbnailUri={item.previewThumbnailUri}
                  thumbnailHeaders={item.previewThumbnailHeaders}
                  isActive={index === currentIndex}
                />
              )}
            </View>
          )}
        />

        <View style={styles.chromeLayer} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭图像预览"
            onPress={onRequestClose}
            style={({ pressed }) => [
              styles.closeButton,
              {
                top: insets.top + 4,
                right: insets.right + 8,
                backgroundColor: pressed ? closeButtonPressedColor : closeButtonColor,
              },
            ]}
          >
            <X size={18} color={theme.text} />
          </Pressable>

          <View
            pointerEvents="none"
            style={[
              styles.counterWrap,
              {
                top: insets.top + 14,
                backgroundColor: counterBackgroundColor,
              },
            ]}
          >
            <Text style={[styles.counterText, { color: theme.text }]}>
              {currentIndex + 1}/{items.length}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  chromeLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  closeButton: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  counterWrap: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  counterText: {
    fontSize: 13,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
})
