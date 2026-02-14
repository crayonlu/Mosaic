import { MOOD_INTENSITY_LEVELS } from '@/constants/common'
import { useThemeStore } from '@/stores/theme-store'
import Slider from '@react-native-community/slider'
import { useCallback } from 'react'
import { StyleSheet, View } from 'react-native'

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

  const handleValueChange = useCallback(
    (newValue: number) => {
      const clampedValue = Math.max(min, Math.min(max, Math.round(newValue)))
      onChange(clampedValue)
    },
    [onChange, min, max]
  )

  return (
    <Slider
      style={styles.slider}
      minimumValue={min}
      maximumValue={max}
      value={value}
      onValueChange={handleValueChange}
      minimumTrackTintColor={theme.primary}
      maximumTrackTintColor={theme.border}
      thumbTintColor={theme.primary}
      step={1}
      disabled={disabled}
    />
  )
}

const styles = StyleSheet.create({
  slider: {
    width: '100%',
    height: 40,
  },
})
