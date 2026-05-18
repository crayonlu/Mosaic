import { useThemeStore } from '@/stores/themeStore'
import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native'

interface SkeletonLineProps {
  width?: DimensionValue
  height?: number
  borderRadius?: number
  style?: ViewStyle
  pulse?: boolean
}

export function SkeletonLine({
  width = '100%',
  height = 14,
  borderRadius = 7,
  style,
  pulse = true,
}: SkeletonLineProps) {
  const { theme } = useThemeStore()
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    if (!pulse) return
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    )
    animation.start()
    return () => animation.stop()
  }, [opacity, pulse])

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: theme.surfaceMuted, opacity: pulse ? opacity : 1 },
        style,
      ]}
    />
  )
}

export function MemoCardSkeleton() {
  const { theme } = useThemeStore()

  return (
    <View style={[styles.card, { borderBottomColor: theme.border }]}>
      <View style={styles.header}>
        <SkeletonLine width={60} height={12} />
        <SkeletonLine width={40} height={10} />
      </View>
      <SkeletonLine width="90%" height={16} style={{ marginBottom: 8 }} />
      <SkeletonLine width="100%" height={12} style={{ marginBottom: 6 }} />
      <SkeletonLine width="75%" height={12} style={{ marginBottom: 12 }} />
      <View style={styles.tagsRow}>
        <SkeletonLine width={48} height={22} borderRadius={11} />
        <SkeletonLine width={64} height={22} borderRadius={11} />
      </View>
    </View>
  )
}

export function MemoListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <MemoCardSkeleton key={i} />
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
