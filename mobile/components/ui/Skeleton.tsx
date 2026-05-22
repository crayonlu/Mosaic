import { useThemeStore } from '@/stores/themeStore'
import { useEffect } from 'react'
import { StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
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
  pulseStyle,
}: SkeletonLineProps & { pulseStyle: ReturnType<typeof useAnimatedStyle> }) {
  const { theme } = useThemeStore()

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: theme.surfaceMuted }, pulseStyle, style]}
    />
  )
}

/** Standalone skeleton line with its own pulse animation */
export function SkeletonLine({
  width = '100%',
  height = 14,
  borderRadius = 7,
  style,
}: SkeletonLineProps) {
  const pulseStyle = usePulseAnimation()

  return (
    <SkeletonLineInner
      width={width}
      height={height}
      borderRadius={borderRadius}
      style={style}
      pulseStyle={pulseStyle}
    />
  )
}

function usePulseAnimation() {
  const opacity = useSharedValue(1)

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.4, { duration: 800 }), withTiming(1, { duration: 800 })),
      -1,
      false
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  return pulseStyle
}

export function MemoCardSkeleton({ pulseStyle }: { pulseStyle?: ReturnType<typeof useAnimatedStyle> }) {
  const { theme } = useThemeStore()
  const fallbackPulse = usePulseAnimation()
  const animStyle = pulseStyle ?? fallbackPulse

  return (
    <View style={[styles.card, { borderBottomColor: theme.border }]}>
      <View style={styles.header}>
        <SkeletonLineInner width={60} height={12} pulseStyle={animStyle} />
        <SkeletonLineInner width={40} height={10} pulseStyle={animStyle} />
      </View>
      <SkeletonLineInner width="90%" height={16} style={{ marginBottom: 8 }} pulseStyle={animStyle} />
      <SkeletonLineInner width="100%" height={12} style={{ marginBottom: 6 }} pulseStyle={animStyle} />
      <SkeletonLineInner width="75%" height={12} style={{ marginBottom: 12 }} pulseStyle={animStyle} />
      <View style={styles.tagsRow}>
        <SkeletonLineInner width={48} height={22} borderRadius={11} pulseStyle={animStyle} />
        <SkeletonLineInner width={64} height={22} borderRadius={11} pulseStyle={animStyle} />
      </View>
    </View>
  )
}

export function MemoListSkeleton({ count = 5 }: { count?: number }) {
  const pulseStyle = usePulseAnimation()

  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <MemoCardSkeleton key={i} pulseStyle={pulseStyle} />
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
