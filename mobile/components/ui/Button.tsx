import { useTheme } from '@/hooks/useTheme'
import React, { JSX } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

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
  const isInactive = disabled || loading
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePressIn = () => {
    scale.value = withTiming(0.97, { duration: 100, easing: Easing.out(Easing.cubic) })
  }

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) })
  }

  const getBackgroundColor = () => {
    if (isInactive) {
      return variant === 'ghost' ? 'transparent' : theme.border
    }
    switch (variant) {
      case 'primary':
        return theme.primary
      case 'secondary':
        return theme.surfaceMuted
      case 'ghost':
        return 'transparent'
      case 'danger':
        return theme.error
      default:
        return theme.primary
    }
  }

  const getTextColor = () => {
    if (isInactive) {
      return theme.textSecondary
    }
    switch (variant) {
      case 'primary':
        return theme.onPrimary
      case 'secondary':
        return theme.text
      case 'ghost':
        return theme.primary
      case 'danger':
        return theme.onPrimary
      default:
        return theme.text
    }
  }

  const getPaddingVertical = () => {
    switch (size) {
      case 'small':
        return theme.spacingScale.small
      case 'medium':
        return theme.spacingScale.medium
      case 'large':
        return theme.spacingScale.large
      default:
        return theme.spacingScale.medium
    }
  }

  const getPaddingHorizontal = () => {
    switch (size) {
      case 'small':
        return leftIcon || rightIcon ? theme.spacingScale.medium : theme.spacingScale.large
      case 'medium':
        return leftIcon || rightIcon ? theme.spacingScale.large : theme.spacingScale.xlarge
      case 'large':
        return leftIcon || rightIcon ? theme.spacingScale.xlarge : theme.spacingScale.xxlarge
      default:
        return leftIcon || rightIcon ? theme.spacingScale.large : theme.spacingScale.xlarge
    }
  }

  const getFontSize = () => {
    switch (size) {
      case 'small':
        return theme.typography.caption.fontSize
      case 'medium':
        return theme.typography.body.fontSize
      case 'large':
        return theme.typography.bodyLarge.fontSize
      default:
        return theme.typography.body.fontSize
    }
  }

  const getBorderColor = () => {
    return 'transparent'
  }

  const getBorderWidth = () => {
    return 0
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isInactive}
      style={style}
    >
      <Animated.View
        style={[
          styles.button,
          {
            backgroundColor: getBackgroundColor(),
            paddingVertical: getPaddingVertical(),
            paddingHorizontal: getPaddingHorizontal(),
            width: fullWidth ? '100%' : undefined,
            borderRadius: theme.radius.medium,
            borderColor: getBorderColor(),
            borderWidth: getBorderWidth(),
            opacity: isInactive ? theme.state.disabledOpacity : 1,
          },
          animatedStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={getTextColor()} size="small" />
        ) : (
          <View style={styles.contentContainer}>
            {leftIcon}
            {title && (
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
            )}
            {rightIcon}
          </View>
        )}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontWeight: '500',
    textAlign: 'center',
  },
})
