import { StyleSheet, View, Text } from 'react-native'
import { useThemeStore } from '@/stores/theme-store'
import { MOOD_INTENSITY_LEVELS } from '@/constants/common'
import { useState } from 'react'

interface MoodSliderProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}

export function MoodSlider({ value, onChange, disabled }: MoodSliderProps) {
  const { theme } = useThemeStore()

  return (
    <View style={styles.container}>
      <View style={styles.labels}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>弱</Text>
        <Text style={[styles.label, { color: theme.textSecondary }]}>强</Text>
      </View>
      <View style={styles.track}>
        {Array.from({ length: MOOD_INTENSITY_LEVELS }).map((_, index) => {
          const intensity = index + 1
          const isActive = intensity <= value
          return (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: isActive ? theme.primary : theme.border,
                  flex: isActive ? intensity : 1,
                  height: isActive ? 8 + intensity * 4 : 8,
                  marginHorizontal: 2,
                },
              ]}
            />
          )
        })}
      </View>
      <View style={styles.indicator}>
        <View
          style={[
            styles.handle,
            {
              backgroundColor: theme.primary,
              left: `${((value - 1) / (MOOD_INTENSITY_LEVELS - 1)) * 100}%`,
            },
          ]}
        />
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
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
  },
  dot: {
    borderRadius: 4,
  },
  indicator: {
    height: 20,
    position: 'relative',
  },
  handle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: 'absolute',
    top: 4,
    transform: [{ translateX: -6 }],
  },
})
