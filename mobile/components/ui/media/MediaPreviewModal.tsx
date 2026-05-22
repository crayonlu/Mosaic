import { useThemeStore } from '@/stores/themeStore'
import { X } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View, type NativeSyntheticEvent } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import PagerView from 'react-native-pager-view'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
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

interface PagerPageSelectedEvent {
  position: number
}

export function MediaPreviewModal({ items, initialIndex, onRequestClose }: MediaPreviewModalProps) {
  const { theme } = useThemeStore()
  const insets = useSafeAreaInsets()
  const pagerRef = useRef<PagerView>(null)
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [isImageZoomActive, setIsImageZoomActive] = useState(false)
  const handleZoomActiveChange = useCallback((val: boolean) => {
    setIsImageZoomActive(val)
  }, [])
  const overlayColor = useMemo(() => withAlpha(theme.background, 0.96), [theme.background])
  const closeButtonColor = useMemo(() => withAlpha(theme.surface, 0.82), [theme.surface])
  const closeButtonPressedColor = useMemo(() => withAlpha(theme.surface, 0.96), [theme.surface])
  const counterBackgroundColor = useMemo(() => withAlpha(theme.surface, 0.7), [theme.surface])

  const contentScale = useSharedValue(0.95)
  const contentOpacity = useSharedValue(0)

  const contentAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: contentScale.value }],
    opacity: contentOpacity.value,
  }))

  useEffect(() => {
    setCurrentIndex(initialIndex)
    setIsImageZoomActive(false)
    pagerRef.current?.setPageWithoutAnimation(initialIndex)
    // Trigger scale-in animation when modal opens
    contentScale.value = 0.95
    contentOpacity.value = 0
    contentScale.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) })
    contentOpacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) })
  }, [initialIndex, contentScale, contentOpacity])

  const handlePageSelected = useCallback((event: NativeSyntheticEvent<PagerPageSelectedEvent>) => {
    setCurrentIndex(event.nativeEvent.position)
    setIsImageZoomActive(false)
  }, [])

  return (
    <Modal
      visible={items.length > 0}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <GestureHandlerRootView style={styles.container}>
        <View style={[styles.container, { backgroundColor: overlayColor }]}>
          <Animated.View style={[styles.pagerWrapper, contentAnimStyle]}>
            <PagerView
              ref={pagerRef}
              style={styles.pager}
              initialPage={initialIndex}
              scrollEnabled={items.length > 1 && !isImageZoomActive}
              onPageSelected={handlePageSelected}
            >
              {items.map((item, index) => {
                const isNearby = Math.abs(index - currentIndex) <= 1
                return (
                  <View key={item.item.key} style={styles.page}>
                    {isNearby ? (
                      item.item.type === 'image' ? (
                        <ImagePreviewContent
                          uri={item.previewUri}
                          headers={item.previewHeaders}
                          lowQualityUri={item.previewLowQualityUri}
                          lowQualityHeaders={item.previewLowQualityHeaders}
                          isActive={index === currentIndex}
                          onZoomActiveChange={index === currentIndex ? handleZoomActiveChange : undefined}
                        />
                      ) : (
                        <VideoPreviewContent
                          uri={item.previewUri}
                          headers={item.previewHeaders}
                          thumbnailUri={item.previewThumbnailUri}
                          thumbnailHeaders={item.previewThumbnailHeaders}
                          isActive={index === currentIndex}
                        />
                      )
                    ) : (
                      <View style={styles.page} />
                    )}
                  </View>
                )
              })}
            </PagerView>
          </Animated.View>

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
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pagerWrapper: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  pager: {
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
