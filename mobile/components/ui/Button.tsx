import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native'

export interface ButtonProps {
  title: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
}

const COLORS = {
  primary: '#D4A574',
  primaryText: '#FFFFFF',
  secondary: 'rgba(0, 0, 0, 0.08)',
  secondaryText: '#2D2D2D',
  ghost: 'transparent',
  ghostText: '#D4A574',
  danger: '#EF4444',
  dangerText: '#FFFFFF',
  disabledText: '#757575',
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
}: ButtonProps) {
  const getBackgroundColor = () => {
    if (disabled || loading) {
      return variant === 'ghost' ? 'transparent' : COLORS.secondary
    }
    switch (variant) {
      case 'primary':
        return COLORS.primary
      case 'secondary':
        return COLORS.secondary
      case 'ghost':
        return COLORS.ghost
      case 'danger':
        return COLORS.danger
      default:
        return COLORS.primary
    }
  }

  const getTextColor = () => {
    if (disabled || loading) {
      return COLORS.disabledText
    }
    switch (variant) {
      case 'primary':
        return COLORS.primaryText
      case 'secondary':
        return COLORS.secondaryText
      case 'ghost':
        return COLORS.ghostText
      case 'danger':
        return COLORS.dangerText
      default:
        return COLORS.primaryText
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
        return 14
      case 'medium':
        return 18
      case 'large':
        return 22
      default:
        return 18
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
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
})
