/**
 * Loading Component
 * Displays a loading indicator with optional text
 */

import { useThemeStore } from '@/stores/theme-store'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

interface LoadingProps {
  size?: 'small' | 'large'
  text?: string
  fullScreen?: boolean
}

export function Loading({ size = 'large', text, fullScreen = false }: LoadingProps) {
  const { theme } = useThemeStore()

  return (
    <View
      style={[
        styles.container,
        fullScreen && styles.fullScreen,
        {
          backgroundColor: 'transparent',
        },
      ]}
    >
      <ActivityIndicator size={size} color={theme.primary} />
      {text && <Text style={[styles.text, { color: theme.textSecondary }]}>{text}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreen: {
    flex: 1,
  },
  text: {
    marginTop: 12,
    fontSize: 14,
  },
})
