import { MOOD_INTENSITY_LEVELS } from '@/constants/common'
import { useThemeStore } from '@/stores/themeStore'
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated'

interface MoodDragBarProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  min?: number
  max?: number
}

export function MoodDragBar({
  value,
  onChange,
  disabled = false,
  min = 1,
  max = MOOD_INTENSITY_LEVELS,
}: MoodDragBarProps) {
  const { theme } = useThemeStore()

  const range = max - min

  const positionRatio = useSharedValue(range > 0 ? (value - min) / range : 0)
  const startRatio = useSharedValue(0)
  const trackWidth = useSharedValue(0)
  const valueRef = useSharedValue(value)

  // Sync external value changes
  useEffect(() => {
    positionRatio.value = range > 0 ? (value - min) / range : 0
    valueRef.value = value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, min, range])

  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .onBegin(() => {
      'worklet'
      startRatio.value = positionRatio.value
    })
    .onUpdate(e => {
      'worklet'
      if (trackWidth.value === 0) return
      const delta = e.translationX / trackWidth.value
      const newRatio = Math.max(0, Math.min(1, startRatio.value + delta))
      positionRatio.value = newRatio
      const newValue = Math.round(min + newRatio * range)
      const clampedValue = Math.max(min, Math.min(max, newValue))
      if (clampedValue !== valueRef.value) {
        valueRef.value = clampedValue
        runOnJS(onChange)(clampedValue)
      }
    })

  const fillStyle = useAnimatedStyle(() => ({
    width: `${positionRatio.value * 100}%`,
  }))

  const thumbStyle = useAnimatedStyle(() => ({
    left: `${positionRatio.value * 100}%`,
  }))

  return (
    <GestureDetector gesture={panGesture}>
      <View
        style={styles.container}
        onLayout={e => {
          trackWidth.value = e.nativeEvent.layout.width
        }}
      >
        <View style={[styles.track, { backgroundColor: theme.border }]} />

        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: theme.primary,
            },
            fillStyle,
          ]}
        />

        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: theme.primary,
            },
            thumbStyle,
          ]}
        />
      </View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 20,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    width: '100%',
    height: 6,
    borderRadius: 3,
  },
  fill: {
    position: 'absolute',
    height: 6,
    borderRadius: 3,
    left: 0,
  },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10,
  },
})
