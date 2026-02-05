import { useThemeStore } from '@/stores/theme-store'
import { MOOD_INTENSITY_LEVELS } from '@/constants/common'
import { useCallback } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Slider from '@react-native-community/slider'

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
      onChange(Math.round(newValue))
    },
    [onChange]
  )

  return (
    <View style={styles.container}>
      <View style={styles.labels}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>轻微</Text>
        <Text style={[styles.label, { color: theme.textSecondary }]}>强烈</Text>
      </View>

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

      <View style={styles.valueContainer}>
        <Text style={[styles.valueText, { color: theme.textSecondary }]}>强度: {value}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  valueContainer: {
    alignItems: 'center',
  },
  valueText: {
    fontSize: 11,
    opacity: 0.7,
  },
})
