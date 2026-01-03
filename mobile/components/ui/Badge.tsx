import { StyleSheet, Text, View } from 'react-native'
import { useThemeStore } from '@/stores/theme-store'

export interface BadgeProps {
  text: string
  variant?: 'solid' | 'outline' | 'soft'
  size?: 'small' | 'medium'
  style?: any
}

export function Badge({ text, variant = 'outline', size = 'medium', style }: BadgeProps) {
  const { theme } = useThemeStore()

  const getBackgroundColor = () => {
    switch (variant) {
      case 'solid':
        return theme.primary
      case 'soft':
        return `${theme.primary}20`
      case 'outline':
        return 'transparent'
      default:
        return 'transparent'
    }
  }

  const getBorderColor = () => {
    switch (variant) {
      case 'outline':
        return theme.primary
      default:
        return 'transparent'
    }
  }

  const getTextColor = () => {
    switch (variant) {
      case 'solid':
        return '#FFFFFF'
      default:
        return theme.primary
    }
  }

  const getPaddingVertical = () => {
    return size === 'small' ? 2 : 4
  }

  const getPaddingHorizontal = () => {
    return size === 'small' ? 6 : 10
  }

  const getFontSize = () => {
    return size === 'small' ? 11 : 12
  }

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === 'outline' ? 1 : 0,
          paddingVertical: getPaddingVertical(),
          paddingHorizontal: getPaddingHorizontal(),
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: getTextColor(),
            fontSize: getFontSize(),
          },
        ]}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '500',
  },
})
