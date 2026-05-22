import { useMoodStore } from '@/stores/moodStore'
import { useThemeStore } from '@/stores/themeStore'
import { getMoodColorWithIntensity } from '@mosaic/utils'
import { LinearGradient } from 'expo-linear-gradient'
import { useSegments } from 'expo-router'
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

/**
 * Standalone mood background component that subscribes to moodStore internally.
 * Isolates mood-driven re-renders from the rest of the root layout tree.
 */
export function MoodBackground() {
  const theme = useThemeStore(s => s.theme)
  const currentMood = useMoodStore(s => s.currentMood)
  const currentMoodIntensity = useMoodStore(s => s.currentMoodIntensity)
  const segments = useSegments()

  const isDiariesTab = segments[0] === '(tabs)' && segments[1] === 'diaries'

  const moodColor = getMoodColorWithIntensity(currentMood, currentMoodIntensity)

  // Animate the mood color directly on the UI thread via interpolateColor.
  // fromColor = last stable color (or previous target on interrupt)
  // toColor   = next color to transition toward
  // progress  = 0->1 drives the interpolation
  const fromColor = useSharedValue(moodColor)
  const toColor = useSharedValue(moodColor)
  const progress = useSharedValue(1)

  useEffect(() => {
    if (moodColor === toColor.value) return
    cancelAnimation(progress)
    fromColor.value = toColor.value // start from previous target
    toColor.value = moodColor
    progress.value = 0
    progress.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moodColor])

  // Runs on UI thread — true RGB lerp at 60fps, no JS bridge
  const moodBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [fromColor.value, toColor.value]),
  }))

  if (!isDiariesTab) return null

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, moodBgStyle]}>
      <LinearGradient
        colors={['transparent', theme.background]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
    </Animated.View>
  )
}
