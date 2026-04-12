import { useThemeStore } from '@/stores/themeStore'
import { Image } from 'expo-image'
import { StyleSheet, View } from 'react-native'

export default function ThemeAwareSplash() {
  const { themeMode } = useThemeStore()
  const isDark = themeMode === 'dark'

  return (
    <View style={[styles.container, isDark ? styles.containerDark : styles.containerLight]}>
      <Image
        source={
          isDark
            ? require('@/assets/images/mosaic-dark.png')
            : require('@/assets/images/mosaic-light.png')
        }
        style={styles.logo}
        contentFit="contain"
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
  containerLight: {
    backgroundColor: '#FFF5EB',
  },
  containerDark: {
    backgroundColor: '#212124',
  },
  logo: {
    width: 120,
    height: 120,
  },
})
