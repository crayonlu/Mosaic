import { useThemeStore } from '@/stores/themeStore'
import { useEffect } from 'react'
import { StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

interface SkeletonLineProps {
  width?: DimensionValue
  height?: number
  borderRadius?: number
  style?: ViewStyle
}

function SkeletonLineInner({
  width = '100%',
  height = 14,
  borderRadius = 7,
  style,
  shimmerStyle,
}: SkeletonLineProps & { shimmerStyle: ReturnType<typeof useAnimatedStyle> }) {
  const { theme } = useThemeStore()

  return (
    <View
      style={[
        { width, height, borderRadius, backgroundColor: theme.surfaceMuted, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]} />
    </View>
  )
}

/** Standalone skeleton line with its own shimmer animation */
export function SkeletonLine({
  width = '100%',
  height = 14,
  borderRadius = 7,
  style,
}: SkeletonLineProps) {
  const shimmerStyle = useShimmerAnimation()

  return (
    <SkeletonLineInner
      width={width}
      height={height}
      borderRadius={borderRadius}
      style={style}
      shimmerStyle={shimmerStyle}
    />
  )
}

function useShimmerAnimation() {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const shimmerStyle = useAnimatedStyle(() => {
    const translateX = interpolate(progress.value, [0, 1], [-100, 100])
    const opacity = interpolate(progress.value, [0, 0.3, 0.5, 0.7, 1], [0, 0.12, 0.24, 0.12, 0])
    return {
      transform: [{ translateX: `${translateX}%` as unknown as number }],
      opacity,
      backgroundColor: '#ffffff',
    }
  })

  return shimmerStyle
}

export function MemoCardSkeleton({
  shimmerStyle,
}: {
  shimmerStyle?: ReturnType<typeof useAnimatedStyle>
}) {
  const { theme } = useThemeStore()
  const fallbackShimmer = useShimmerAnimation()
  const animStyle = shimmerStyle ?? fallbackShimmer

  return (
    <View style={[styles.card, { borderBottomColor: theme.border }]}>
      <View style={styles.header}>
        <SkeletonLineInner width={60} height={12} shimmerStyle={animStyle} />
        <SkeletonLineInner width={40} height={10} shimmerStyle={animStyle} />
      </View>
      <SkeletonLineInner
        width="90%"
        height={16}
        style={{ marginBottom: 8 }}
        shimmerStyle={animStyle}
      />
      <SkeletonLineInner
        width="100%"
        height={12}
        style={{ marginBottom: 6 }}
        shimmerStyle={animStyle}
      />
      <SkeletonLineInner
        width="75%"
        height={12}
        style={{ marginBottom: 12 }}
        shimmerStyle={animStyle}
      />
      <View style={styles.tagsRow}>
        <SkeletonLineInner width={48} height={22} borderRadius={11} shimmerStyle={animStyle} />
        <SkeletonLineInner width={64} height={22} borderRadius={11} shimmerStyle={animStyle} />
      </View>
    </View>
  )
}

export function MemoListSkeleton({ count = 5 }: { count?: number }) {
  const shimmerStyle = useShimmerAnimation()

  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <MemoCardSkeleton key={i} shimmerStyle={shimmerStyle} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
  },
})
