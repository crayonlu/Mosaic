import { useDevStore } from '@/stores/devStore'
import { useState } from 'react'
import { Dimensions, StyleSheet, Text, View } from 'react-native'
import { runOnJS, useFrameCallback, useSharedValue } from 'react-native-reanimated'

interface FPSMonitorProps {
  /** Update interval in ms. Default 500ms. */
  updateInterval?: number
}

export function FPSMonitor({ updateInterval = 500 }: FPSMonitorProps) {
  const [fps, setFps] = useState(0)
  const frameCount = useSharedValue(0)
  const lastTime = useSharedValue(0)

  useFrameCallback(({ timestamp }) => {
    'worklet'
    if (lastTime.value === 0) {
      lastTime.value = timestamp
      return
    }
    frameCount.value += 1

    const elapsed = timestamp - lastTime.value
    if (elapsed >= updateInterval) {
      const currentFps = Math.round((frameCount.value * 1000) / elapsed)
      runOnJS(setFps)(currentFps)
      frameCount.value = 0
      lastTime.value = timestamp
    }
  })

  // Color-code: red < 30, yellow < 55, green ≥ 55
  const color = fps < 30 ? '#ff4444' : fps < 55 ? '#ffaa00' : '#44dd44'

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={[styles.pill, { borderColor: color }]}>
        <Text style={[styles.text, { color }]}>{fps} FPS</Text>
      </View>
    </View>
  )
}

/**
 * Store-controlled wrapper. Render this at app root; toggled by Dev tab.
 */
export function DevFpsOverlay() {
  const showFps = useDevStore(s => s.showFps)
  if (!showFps) return null
  return <FPSMonitor />
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: SCREEN_W / 2 - 50,
    top: SCREEN_H / 2 - 18,
    zIndex: 99999,
    elevation: 99999,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    minWidth: 80,
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
})
