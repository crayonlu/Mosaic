import { useThemeStore } from '@/stores/theme-store'
import { Image, StyleSheet, View } from 'react-native'

export default function ThemeAwareSplash() {
  const { themeMode, theme } = useThemeStore()

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Image
        source={
          themeMode === 'dark'
            ? require('@/assets/images/mosaic-dark.png')
            : require('@/assets/images/mosaic-light.png')
        }
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
})
