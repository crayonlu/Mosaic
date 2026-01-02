import { Dimensions, PixelRatio } from 'react-native'

const { width, height } = Dimensions.get('window')

const wp = (percentage: number): number => {
  const dimension = width < height ? width : height
  return PixelRatio.roundToNearestPixel((dimension * percentage) / 100)
}

const hp = (percentage: number): number => {
  const dimension = width < height ? height : width
  return PixelRatio.roundToNearestPixel((dimension * percentage) / 100)
}

export const responsive = {
  width,
  height,
  wp,
  hp,
  isPortrait: height > width,
  isLandscape: width > height,
  isSmallDevice: width < 375,
  isTablet: width >= 768,
  scale: (value: number, baseWidth: number = 375) => (width / baseWidth) * value,
}
