import type { ConfigContext, ExpoConfig } from 'expo/config'
import bootsplash from 'react-native-bootsplash/expo'
import appJson from './app.json'

const baseConfig = appJson.expo as ExpoConfig

export default ({ config }: ConfigContext): ExpoConfig => {
  const merged: ExpoConfig = {
    ...config,
    ...baseConfig,
    platforms: ['android', 'ios', 'web'],
    plugins: [...(baseConfig.plugins ?? [])],
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
