import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

interface ExpandablePanelProps {
  /** Whether the panel is expanded */
  expanded: boolean
  /** Content to render inside the scrollable area */
  children: React.ReactNode
  /** Maximum visible height when set. No cap by default — panel expands to full content height. */
  maxHeight?: number
}

/**
 * An animated collapsible panel.
 *
 * When `maxHeight` is set, the panel shows a fixed-height viewport with internal scrolling
 * (content overflows → scrollable). Without `maxHeight`, the panel expands to full content
 * height (no scrolling) — suitable for short content like settings sections.
 *
 * Collapse is instant (no animation) to avoid layout thrashing when bottom edge is visible.
 */
export function ExpandablePanel({ expanded, children, maxHeight }: ExpandablePanelProps) {
  const [contentHeight, setContentHeight] = useState(0)
  const animHeight = useSharedValue(0)

  useEffect(() => {
    if (expanded && contentHeight > 0) {
      const targetHeight = maxHeight != null ? Math.min(contentHeight, maxHeight) : contentHeight
      animHeight.value = withTiming(targetHeight, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      })
    } else if (!expanded) {
      // Collapse instantly to avoid layout thrashing
      animHeight.value = 0
    }
  }, [expanded, contentHeight, maxHeight, animHeight])

  const expandStyle = useAnimatedStyle(() => ({
    height: animHeight.value,
    overflow: 'hidden' as const,
  }))

  return (
    <Animated.View style={expandStyle}>
      <ScrollView
        style={maxHeight != null ? { maxHeight, height: maxHeight } : undefined}
        showsVerticalScrollIndicator
        nestedScrollEnabled
      >
        <View
          onLayout={e => {
            const h = e.nativeEvent.layout.height
            if (h > 0 && h !== contentHeight) setContentHeight(h)
          }}
        >
          {children}
        </View>
      </ScrollView>
    </Animated.View>
  )
}
