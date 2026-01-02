import { Platform } from 'react-native'

export const platformUtils = {
  isIOS: Platform.OS === 'ios',
  isAndroid: Platform.OS === 'android',
  isWeb: Platform.OS === 'web',
  getSafeAreaInsets: () => {
    return { top: 0, bottom: 0, left: 0, right: 0 }
  },
}
