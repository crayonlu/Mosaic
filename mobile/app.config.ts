import type { ConfigContext, ExpoConfig } from 'expo/config'
import bootsplash from 'react-native-bootsplash/expo'
import appJson from './app.json'

const baseConfig = appJson.expo as ExpoConfig

export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins = [...(baseConfig.plugins ?? [])]

  // Ensure required plugins are present
  const hasLocalization = plugins.some(p =>
    typeof p === 'string' ? p === 'expo-localization' : p[0] === 'expo-localization'
  )
  const hasSecureStore = plugins.some(p =>
    typeof p === 'string' ? p === 'expo-secure-store' : p[0] === 'expo-secure-store'
  )
  if (!hasLocalization) plugins.push('expo-localization')
  if (!hasSecureStore) plugins.push('expo-secure-store')

  const merged: ExpoConfig = {
    ...config,
    ...baseConfig,
    platforms: ['android', 'ios', 'web'],
    plugins,
  }

  merged.plugins?.push(
    bootsplash({
      logo: './assets/images/mosaic-light.png',
      logoWidth: 120,
      background: '#EFE8DD',
    })
  )

  merged.plugins?.push([
    'expo-share-intent',
    {
      androidIntentFilters: ['text/plain', 'image/*'],
      androidMainActivityAttributes: {
        'android:launchMode': 'singleTask',
      },
    },
  ])

  return merged
}
