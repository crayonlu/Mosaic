import { useRef } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'

export interface SegmentOption {
  label: string
  value: string
}

interface SlidingSegmentedControlProps {
  options: SegmentOption[]
  value: string
  onChange: (value: string) => void
  surfaceMuted: string
  surface: string
  textColor: string
  textMuted: string
  radius: number
}

export function SlidingSegmentedControl({
  options,
  value,
  onChange,
  surfaceMuted,
  surface,
  textColor,
  textMuted,
  radius,
}: SlidingSegmentedControlProps) {
  const activeIndex = options.findIndex(o => o.value === value)
  const segmentWidth = useRef(0)
  const thumbLeft = useSharedValue(-1)
  const prevIndexRef = useRef(-1)

  const thumbStyle = useAnimatedStyle(() => ({
    left: thumbLeft.value < 0 ? 2 : thumbLeft.value,
    opacity: thumbLeft.value < 0 ? 0 : 1,
  }))

  const handleLayout = (totalWidth: number) => {
    const w = (totalWidth - 4) / options.length
    segmentWidth.current = w
    const targetLeft = 2 + activeIndex * w
    thumbLeft.value = targetLeft
    prevIndexRef.current = activeIndex
  }

  const handlePress = (index: number) => {
    onChange(options[index].value)
    if (segmentWidth.current > 0) {
      thumbLeft.value = withSpring(2 + index * segmentWidth.current, {
        damping: 20,
        stiffness: 220,
        mass: 0.6,
      })
    }
    prevIndexRef.current = index
  }

  return (
    <View
      style={[styles.track, { backgroundColor: surfaceMuted, borderRadius: radius }]}
      onLayout={e => handleLayout(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[
          styles.thumb,
          thumbStyle,
          {
            width: `${100 / options.length}%` as unknown as number,
            backgroundColor: surface,
            borderRadius: Math.max(4, radius - 1),
          },
        ]}
      />
      {options.map((opt, i) => (
        <TouchableOpacity
          key={opt.value}
          style={styles.option}
          onPress={() => handlePress(i)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.label,
              { color: value === opt.value ? textColor : textMuted },
              value === opt.value && styles.labelActive,
            ]}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 2,
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  option: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  label: {
    fontSize: 13,
  },
  labelActive: {
    fontWeight: '600',
  },
})
