import { useThemeStore } from '@/stores/themeStore'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export interface BadgeProps {
  text: string
  variant?: 'solid' | 'outline' | 'soft'
  size?: 'small' | 'medium'
  style?: any
  onPress?: () => void
}

export function Badge({ text, variant = 'outline', size = 'medium', style, onPress }: BadgeProps) {
  const { theme } = useThemeStore()

  const getBackgroundColor = () => {
    switch (variant) {
      case 'solid':
        return theme.primary
      case 'soft':
        return theme.semantic.infoSoft
      case 'outline':
        return 'transparent'
      default:
        return 'transparent'
    }
  }

  const getBorderColor = () => {
    switch (variant) {
      case 'solid':
        return 'transparent'
      case 'outline':
        return theme.borderStrong
      case 'soft':
        return theme.border
      default:
        return 'transparent'
    }
  }

  const getTextColor = () => {
    switch (variant) {
      case 'solid':
        return theme.onPrimary
      case 'soft':
        return theme.info
      default:
        return theme.text
    }
  }

  const getPaddingVertical = () => {
    return size === 'small' ? theme.spacingScale.xsmall : theme.spacingScale.small
  }

  const getPaddingHorizontal = () => {
    return size === 'small' ? 6 : theme.spacingScale.medium
  }

  const getFontSize = () => {
    return size === 'small' ? 11 : theme.typography.caption
  }

  const badgeContent = (
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
  )

  if (onPress) {
    return (
      <TouchableOpacity
        style={[
          styles.badge,
          {
            backgroundColor: getBackgroundColor(),
            borderColor: getBorderColor(),
            borderWidth: 1,
            paddingVertical: getPaddingVertical(),
            paddingHorizontal: getPaddingHorizontal(),
            borderRadius: theme.radius.pill,
          },
          style,
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {badgeContent}
      </TouchableOpacity>
    )
  }

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === 'outline' || variant === 'soft' ? 1 : 0,
          paddingVertical: getPaddingVertical(),
          paddingHorizontal: getPaddingHorizontal(),
          borderRadius: theme.radius.pill,
        },
        style,
      ]}
    >
      {badgeContent}
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '500',
  },
})
