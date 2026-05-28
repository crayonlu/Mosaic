/**
 * BrandLoader — branded loading indicator using the app's flower icon
 * Rotates continuously while loading, then scales to 0 and fades out when done.
 */

import { Image } from 'expo-image'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

interface BrandLoaderProps {
  loading: boolean
  size?: number
  delay?: number
}

export function BrandLoader({ loading, size = 40, delay = 300 }: BrandLoaderProps) {
  const [visible, setVisible] = useState(false)
  const rotation = useSharedValue(0)
  const scale = useSharedValue(1)
  const opacity = useSharedValue(1)
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (loading) {
      // Delay showing to avoid flash for fast loads
      delayTimerRef.current = setTimeout(() => {
        setVisible(true)
        // Start rotation
        rotation.value = 0
        scale.value = 1
        opacity.value = 1
        rotation.value = withRepeat(
          withTiming(360, { duration: 2500, easing: Easing.linear }),
          -1,
          false
        )
      }, delay)
    } else {
      // Cancel delay timer if loading finished before delay
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current)
        delayTimerRef.current = null
      }

      if (visible) {
        // Animate out: scale to 0 + fade
        scale.value = withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) })
        opacity.value = withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) }, () => {
          cancelAnimation(rotation)
        })
        // Hide after animation completes
        const hideTimer = setTimeout(() => setVisible(false), 320)
        return () => clearTimeout(hideTimer)
      }
    }

    return () => {
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current)
        delayTimerRef.current = null
      }
    }
  }, [loading, delay, visible, rotation, scale, opacity])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
    opacity: opacity.value,
  }))

  if (!visible && !loading) return null

  return (
    <View style={styles.container}>
      {visible && (
        <Animated.View style={[styles.loaderWrapper, animatedStyle]}>
          <Image
            source={require('@/assets/images/android-icon-foreground.png')}
            style={{ width: size, height: size }}
            contentFit="contain"
          />
        </Animated.View>
      )}
    </View>
  )
}

/**
 * BrandLoaderView — wraps content with a brand loader overlay.
 * Shows the loader while loading, then fades in the content.
 */
interface BrandLoaderViewProps {
  loading: boolean
  size?: number
  delay?: number
  children: React.ReactNode
}

export function BrandLoaderView({ loading, size, delay, children }: BrandLoaderViewProps) {
  const [showContent, setShowContent] = useState(!loading)

  useEffect(() => {
    if (!loading) {
      // Small delay to let exit animation play
      const timer = setTimeout(() => setShowContent(true), 50)
      return () => clearTimeout(timer)
    } else {
      setShowContent(false)
    }
  }, [loading])

  if (loading || !showContent) {
    return <BrandLoader loading={loading} size={size} delay={delay} />
  }

  return (
    <Animated.View
      entering={FadeIn.duration(250).easing(Easing.out(Easing.cubic))}
      style={{ flex: 1 }}
    >
      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  loaderWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
})
