import { useTheme } from '@/hooks/use-theme'
import React, { JSX } from 'react'
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native'

export interface ButtonProps {
  title?: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
  leftIcon?: JSX.Element
  rightIcon?: JSX.Element
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  leftIcon,
  rightIcon,
}: ButtonProps) {
  const { theme } = useTheme()

  const getBackgroundColor = () => {
    if (disabled || loading) {
      return variant === 'ghost' ? 'transparent' : theme.border
    }
    switch (variant) {
      case 'primary':
        return theme.primary
      case 'secondary':
        return theme.border
      case 'ghost':
        return 'transparent'
      case 'danger':
        return theme.primary
      default:
        return theme.primary
    }
  }

  const getTextColor = () => {
    if (disabled || loading) {
      return theme.textSecondary
    }
    switch (variant) {
      case 'primary':
        return '#FFFFFF'
      case 'secondary':
        return theme.text
      case 'ghost':
        return theme.primary
      case 'danger':
        return '#FFFFFF'
      default:
        return theme.text
    }
  }

  const getPaddingVertical = () => {
    switch (size) {
      case 'small':
        return 6
      case 'medium':
        return 8
      case 'large':
        return 10
      default:
        return 8
    }
  }

  const getPaddingHorizontal = () => {
    switch (size) {
      case 'small':
        return leftIcon || rightIcon ? 10 : 14
      case 'medium':
        return leftIcon || rightIcon ? 14 : 18
      case 'large':
        return leftIcon || rightIcon ? 16 : 22
      default:
        return leftIcon || rightIcon ? 14 : 18
    }
  }

  const getFontSize = () => {
    switch (size) {
      case 'small':
        return 13
      case 'medium':
        return 15
      case 'large':
        return 17
      default:
        return 15
    }
  }

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          paddingVertical: getPaddingVertical(),
          paddingHorizontal: getPaddingHorizontal(),
          width: fullWidth ? '100%' : undefined,
          opacity: disabled || loading ? 0.4 : 1,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <View style={styles.contentContainer}>
          {leftIcon}
          { 
            title && (
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
                {title}
              </Text>
            )
          }
          {rightIcon}
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    minHeight: 40,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
})
