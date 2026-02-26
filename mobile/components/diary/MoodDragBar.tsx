import { MOOD_INTENSITY_LEVELS } from '@/constants/common'
import { useThemeStore } from '@/stores/theme-store'
import { useRef } from 'react'
import { StyleSheet, View, PanResponder, LayoutChangeEvent } from 'react-native'

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
  disabled,
  min = 1,
  max = MOOD_INTENSITY_LEVELS,
}: MoodDragBarProps) {
  const { theme } = useThemeStore()
  
  const trackWidthRef = useRef(0)
  const valueRef = useRef(value)
  const startValueRef = useRef(value)
  
  valueRef.current = value
  const range = max - min

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderTerminationRequest: () => false,
      
      onPanResponderGrant: () => {
        startValueRef.current = valueRef.current
      },
      
      onPanResponderMove: (_, gestureState) => {
        if (trackWidthRef.current === 0) return
        
        const deltaRatio = gestureState.dx / trackWidthRef.current
        const deltaValue = deltaRatio * range
        
        const newValue = Math.round(startValueRef.current + deltaValue)
        const clampedValue = Math.max(min, Math.min(max, newValue))
        
        if (clampedValue !== valueRef.current) {
          onChange(clampedValue)
        }
      },
    })
  ).current

  const handleLayout = (e: LayoutChangeEvent) => {
    trackWidthRef.current = e.nativeEvent.layout.width
  }

  const percentage = range > 0 ? ((value - min) / range) * 100 : 0

  return (
    <View 
      style={styles.container} 
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
      <View style={[styles.track, { backgroundColor: theme.border }]} />
      
      <View 
        style={[
          styles.fill, 
          { 
            backgroundColor: theme.primary,
            width: `${percentage}%` 
          }
        ]} 
      />
      
      <View 
        style={[
          styles.thumb, 
          { 
            backgroundColor: theme.primary,
            left: `${percentage}%` 
          }
        ]} 
      />
    </View>
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