import { useMediaPreviewStore } from '@/stores/mediaPreviewStore'
import { useThemeStore } from '@/stores/themeStore'
import { Image } from 'expo-image'
import { Maximize2, Minus, Plus, RotateCcw } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { withAlpha } from './mediaPreviewUtils'

interface ImagePreviewContentProps {
  uri: string
  headers?: Record<string, string>
  lowQualityUri?: string
  lowQualityHeaders?: Record<string, string>
  isActive: boolean
  onZoomActiveChange?: (isZoomActive: boolean) => void
}

const MIN_SCALE = 1
const MAX_SCALE = 5

function clamp(value: number, min: number, max: number): number {
  'worklet'
  return Math.max(min, Math.min(max, value))
}

export function ImagePreviewContent({
  uri,
  headers,
  lowQualityUri,
  lowQualityHeaders,
  isActive,
  onZoomActiveChange,
}: ImagePreviewContentProps) {
  const { theme } = useThemeStore()
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const loadingOverlayColor = withAlpha(theme.background, 0.18)
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const savedTranslateX = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)
  const rotation = useSharedValue(0)
  const rotationTarget = useSharedValue(0)
  const isZoomedShared = useSharedValue(false)
  const [scaleLabel, setScaleLabel] = useState(100)
  const initialUri = lowQualityUri ?? uri
  const initialHeaders = lowQualityUri ? lowQualityHeaders : headers
  const canLoadOriginal = Boolean(lowQualityUri && lowQualityUri !== uri)
  const hasViewedOriginal = useMediaPreviewStore(state => state.hasViewedOriginalImage(uri))
  const markOriginalViewed = useMediaPreviewStore(state => state.markOriginalImageViewed)
  const shouldStartWithOriginal = !canLoadOriginal || hasViewedOriginal
  const [shouldLoadOriginal, setShouldLoadOriginal] = useState(shouldStartWithOriginal)
  const [isOriginalLoaded, setIsOriginalLoaded] = useState(shouldStartWithOriginal)
  const [isOriginalLoading, setIsOriginalLoading] = useState(false)
  const [isZoomedJS, setIsZoomedJS] = useState(false)

  useEffect(() => {
    setIsInitialLoading(true)
    setShouldLoadOriginal(shouldStartWithOriginal)
    setIsOriginalLoaded(shouldStartWithOriginal)
    setIsOriginalLoading(false)
    isZoomedShared.value = false
    scale.value = 1
    savedScale.value = 1
    translateX.value = 0
    translateY.value = 0
    savedTranslateX.value = 0
    savedTranslateY.value = 0
    rotationTarget.value = 0
    rotation.value = 0
    setScaleLabel(100)
    setIsZoomedJS(false)
    onZoomActiveChange?.(false)
  }, [canLoadOriginal, lowQualityUri, shouldStartWithOriginal, uri])

  useEffect(() => {
    if (isActive) return

    isZoomedShared.value = false
    scale.value = withTiming(1)
    savedScale.value = 1
    translateX.value = withTiming(0)
    translateY.value = withTiming(0)
    savedTranslateX.value = 0
    savedTranslateY.value = 0
    rotationTarget.value = 0
    rotation.value = withTiming(0)
    setScaleLabel(100)
    setIsZoomedJS(false)
    onZoomActiveChange?.(false)
  }, [
    isActive,
    onZoomActiveChange,
    rotation,
    rotationTarget,
    savedScale,
    savedTranslateX,
    savedTranslateY,
    scale,
    translateX,
    translateY,
  ])

  // JS-side callbacks — called sparingly, never on every pinch frame
  const syncZoomState = (nextScale: number) => {
    const isZoomed = nextScale > 1.01
    setIsZoomedJS(isZoomed)
    onZoomActiveChange?.(isZoomed)
    setScaleLabel(Math.round(nextScale * 100))
  }

  // Track whether paging has been locked during the current pinch gesture
  const pagingLocked = useSharedValue(false)

  const pinchGesture = Gesture.Pinch()
    .enabled(isActive)
    .onBegin(() => {
      pagingLocked.value = false
    })
    .onUpdate(event => {
      if (event.numberOfPointers < 2) return
      const nextScale = clamp(savedScale.value * event.scale, MIN_SCALE, MAX_SCALE)
      scale.value = nextScale
      isZoomedShared.value = nextScale > 1.01
      // Lock paging exactly once per gesture, on the UI thread
      if (!pagingLocked.value && onZoomActiveChange) {
        pagingLocked.value = true
        runOnJS(onZoomActiveChange)(true)
      }
    })
    .onEnd(() => {
      if (scale.value <= 1.05) {
        scale.value = withTiming(1)
        translateX.value = withTiming(0)
        translateY.value = withTiming(0)
        savedTranslateX.value = 0
        savedTranslateY.value = 0
        savedScale.value = 1
        isZoomedShared.value = false
        runOnJS(syncZoomState)(1)
        return
      }

      savedScale.value = scale.value
      runOnJS(syncZoomState)(scale.value)
    })

  const panGesture = Gesture.Pan()
    // Only enable pan when zoomed in; disabled means PagerView gets all touch events
    .enabled(isActive && isZoomedJS)
    .minDistance(4)
    .onBegin(() => {})
    .onUpdate(event => {
      translateX.value = savedTranslateX.value + event.translationX
      translateY.value = savedTranslateY.value + event.translationY
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
    })

  const doubleTapGesture = Gesture.Tap()
    .enabled(isActive)
    .numberOfTaps(2)
    .maxDistance(20)
    .onBegin(() => {})
    .onEnd((_event, success) => {
      if (!success) return
      if (scale.value > 1.01) {
        scale.value = withTiming(1)
        savedScale.value = 1
        rotationTarget.value = 0
        rotation.value = withTiming(0)
        translateX.value = withTiming(0)
        translateY.value = withTiming(0)
        savedTranslateX.value = 0
        savedTranslateY.value = 0
        isZoomedShared.value = false
        runOnJS(syncZoomState)(1)
        return
      }

      scale.value = withTiming(2.5)
      savedScale.value = 2.5
      isZoomedShared.value = true
      runOnJS(syncZoomState)(2.5)
    })

  // Split into two layers:
  // - outer: doubleTap alone, so its ~300ms wait window does NOT hold the touch
  //   stream that PagerView's native swipe needs
  // - inner: pinch + pan simultaneously
  const zoomGesture = Gesture.Simultaneous(pinchGesture, panGesture)
  const composedGesture = doubleTapGesture

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }))

  const applyScale = (nextScale: number) => {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale))
    scale.value = withTiming(clamped)
    savedScale.value = clamped
    if (clamped <= 1.01) {
      translateX.value = withTiming(0)
      translateY.value = withTiming(0)
      savedTranslateX.value = 0
      savedTranslateY.value = 0
    }
    isZoomedShared.value = clamped > 1.01
    syncZoomState(clamped)
  }

  const resetTransform = () => {
    scale.value = withTiming(1)
    savedScale.value = 1
    translateX.value = withTiming(0)
    translateY.value = withTiming(0)
    savedTranslateX.value = 0
    savedTranslateY.value = 0
    rotationTarget.value = 0
    rotation.value = withTiming(0)
    isZoomedShared.value = false
    syncZoomState(1)
  }

  const rotateImage = () => {
    const nextRotation = (rotationTarget.value + 90) % 360
    rotationTarget.value = nextRotation
    rotation.value = withTiming(nextRotation)
  }

  const loadOriginalImage = () => {
    setIsInitialLoading(false)
    setIsOriginalLoading(true)
    setShouldLoadOriginal(true)
  }

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View collapsable={false} style={styles.gestureLayer}>
          <GestureDetector gesture={zoomGesture}>
            <Animated.View collapsable={false} style={styles.gestureLayer}>
              <Animated.View style={[styles.imageLayer, animatedImageStyle]}>
                <Image
                  source={{ uri: initialUri, headers: initialHeaders }}
                  style={[styles.image, isOriginalLoaded ? styles.hiddenImage : undefined]}
                  contentFit="contain"
                  transition={isOriginalLoaded ? 0 : undefined}
                  onLoadStart={() => {
                    if (!shouldLoadOriginal) {
                      setIsInitialLoading(true)
                    }
                  }}
                  onLoad={() => setIsInitialLoading(false)}
                  onError={() => setIsInitialLoading(false)}
                />
                {shouldLoadOriginal ? (
                  <Image
                    source={{ uri, headers }}
                    style={[
                      styles.originalImage,
                      !isOriginalLoaded ? styles.hiddenImage : undefined,
                    ]}
                    contentFit="contain"
                    transition={0}
                    onLoad={() => {
                      setIsInitialLoading(false)
                      setIsOriginalLoaded(true)
                      setIsOriginalLoading(false)
                      markOriginalViewed(uri)
                    }}
                    onError={() => {
                      setShouldLoadOriginal(false)
                      setIsOriginalLoading(false)
                    }}
                  />
                ) : null}
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        </Animated.View>
      </GestureDetector>

      {isActive && isInitialLoading && !shouldLoadOriginal ? (
        <View style={[styles.loadingOverlay, { backgroundColor: loadingOverlayColor }]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : null}

      {isActive ? (
        <>
          {canLoadOriginal && !shouldLoadOriginal && !isOriginalLoaded && !isOriginalLoading ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="查看原图"
              style={[
                styles.originalButton,
                {
                  backgroundColor: withAlpha(theme.surface, 0.82),
                  borderColor: withAlpha(theme.text, 0.1),
                },
              ]}
              onPress={loadOriginalImage}
            >
              <Text style={[styles.originalButtonText, { color: theme.text }]}>查看原图</Text>
            </Pressable>
          ) : null}

          <View
            style={[
              styles.toolbar,
              {
                backgroundColor: withAlpha(theme.surface, 0.78),
                borderColor: withAlpha(theme.text, 0.1),
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="缩小图片"
              style={styles.toolButton}
              onPress={() => applyScale(scale.value - 0.35)}
            >
              <Minus size={16} color={theme.text} />
            </Pressable>
            <Text style={[styles.scaleText, { color: theme.textSecondary }]}>{scaleLabel}%</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="放大图片"
              style={styles.toolButton}
              onPress={() => applyScale(scale.value + 0.35)}
            >
              <Plus size={16} color={theme.text} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="旋转图片"
              style={styles.toolButton}
              onPress={rotateImage}
            >
              <RotateCcw size={16} color={theme.text} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="最大化图片"
              style={styles.toolButton}
              onPress={() => applyScale(MAX_SCALE)}
            >
              <Maximize2 size={16} color={theme.text} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="复位图片"
              style={styles.resetButton}
              onPress={resetTransform}
            >
              <Text style={[styles.resetText, { color: theme.text }]}>复位</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  hiddenImage: {
    opacity: 0,
  },
  gestureLayer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageLayer: {
    width: '100%',
    height: '100%',
  },
  originalButton: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 80,
    minHeight: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  originalButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  originalImage: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 42,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 10,
  },
  resetText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scaleText: {
    minWidth: 44,
    textAlign: 'center',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  toolbar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  toolButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
