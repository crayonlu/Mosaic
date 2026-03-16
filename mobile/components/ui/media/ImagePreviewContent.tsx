import { useThemeStore } from '@/stores/themeStore'
import { Image } from 'expo-image'
import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { withAlpha } from './mediaPreviewUtils'

interface ImagePreviewContentProps {
  uri: string
  headers?: Record<string, string>
  isActive: boolean
}

export function ImagePreviewContent({ uri, headers, isActive }: ImagePreviewContentProps) {
  const { theme } = useThemeStore()
  const [isLoading, setIsLoading] = useState(true)
  const loadingOverlayColor = withAlpha(theme.background, 0.18)

  useEffect(() => {
    setIsLoading(true)
  }, [uri])

  return (
    <View style={styles.container}>
      <Image
        source={{ uri, headers }}
        style={styles.image}
        contentFit="contain"
        onLoadStart={() => setIsLoading(true)}
        onLoad={() => setIsLoading(false)}
        onError={() => setIsLoading(false)}
      />

      {isActive && isLoading ? (
        <View style={[styles.loadingOverlay, { backgroundColor: loadingOverlayColor }]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
