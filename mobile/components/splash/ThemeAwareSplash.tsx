import { Image } from 'expo-image'
import { StyleSheet, View } from 'react-native'

export default function ThemeAwareSplash() {
  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/mosaic-light.png')}
        style={styles.logo}
        contentFit="contain"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFF5EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
  },
})
