import type { FlatList } from 'react-native'
import dayjs from 'dayjs'
import { useCallback, useRef, useState } from 'react'
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { dateToIndex } from './useDiaryFlashList'

interface UseFlashListJumpAnimationOptions {
  listRef: React.RefObject<FlatList<number> | null>
  onNextMomentumRef: React.RefObject<(() => void) | null>
  anchorDate: dayjs.Dayjs
  today: dayjs.Dayjs
  currentDateRef: React.RefObject<string>
  isProgrammaticScrollRef: React.RefObject<boolean>
  setCurrentDate: (date: string) => void
  normalizeDate: (date: string) => string
}

interface UseFlashListJumpAnimationReturn {
  jumpAnimStyle: ReturnType<typeof useAnimatedStyle>
  overlayAnimStyle: ReturnType<typeof useAnimatedStyle>
  overlayDate: string
  animatedNavigateToDate: (targetDate: string) => void
}

export function useFlashListJumpAnimation({
  listRef,
  onNextMomentumRef,
  anchorDate,
  today,
  currentDateRef,
  isProgrammaticScrollRef,
  setCurrentDate,
  normalizeDate,
}: UseFlashListJumpAnimationOptions): UseFlashListJumpAnimationReturn {
  const isFirstLoadRef = useRef(true)
  const [overlayDate, setOverlayDate] = useState('')

  // FlatList wrapper: compress → restore on jump
  const scale = useSharedValue(1)
  const opacity = useSharedValue(1)

  const jumpAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  // Full-screen overlay: shown during jump to cover unrendered FlatList frames
  const overlayOpacity = useSharedValue(0)

  const overlayAnimStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    pointerEvents: overlayOpacity.value > 0 ? 'none' : 'none',
  }))

  const animatedNavigateToDate = useCallback(
    (targetDate: string) => {
      const safeTarget = normalizeDate(targetDate)
      if (safeTarget === currentDateRef.current) return

      const animated = !isFirstLoadRef.current
      isFirstLoadRef.current = false

      setCurrentDate(safeTarget)

      if (!animated) {
        const index = dateToIndex(safeTarget, anchorDate)
        isProgrammaticScrollRef.current = true
        listRef.current?.scrollToIndex({ index, animated: false, viewOffset: 0, viewPosition: 0 })
        return
      }

      // Show overlay with target date immediately, hiding the gap frames
      setOverlayDate(safeTarget)
      overlayOpacity.value = 1

      // FlatList whoosh
      scale.value = withSequence(
        withTiming(0.95, { duration: 60, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) })
      )
      opacity.value = withSequence(
        withTiming(0.55, { duration: 60, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) }, () => {
          // Fade out overlay once FlatList has settled on the target item
          overlayOpacity.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.quad) })
        })
      )

      onNextMomentumRef.current = () => {}

      const index = dateToIndex(safeTarget, anchorDate)
      isProgrammaticScrollRef.current = true
      listRef.current?.scrollToIndex({ index, animated: true, viewOffset: 0, viewPosition: 0 })
    },
    [
      anchorDate,
      currentDateRef,
      isProgrammaticScrollRef,
      listRef,
      normalizeDate,
      onNextMomentumRef,
      opacity,
      overlayOpacity,
      scale,
      setCurrentDate,
    ]
  )

  return { jumpAnimStyle, overlayAnimStyle, overlayDate, animatedNavigateToDate }
}
