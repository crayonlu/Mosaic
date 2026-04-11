/**
 * Loading Component
 * Displays a loading indicator with optional text
 */

import { useThemeStore } from '@/stores/themeStore'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

interface LoadingProps {
  size?: 'small' | 'large'
  text?: string
  fullScreen?: boolean
}

export function Loading({ size = 'large', text, fullScreen = false }: LoadingProps) {
  const { theme } = useThemeStore()
  const textSize = theme.typography?.body ?? 14
  const textMarginTop = theme.spacingScale?.medium ?? 12

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
      {text && (
        <Text
          style={[
            styles.text,
            {
              color: theme.textSecondary,
              fontSize: textSize,
              marginTop: textMarginTop,
            },
          ]}
        >
          {text}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreen: {
    flex: 1,
  },
  text: {
    textAlign: 'center',
  },
})
