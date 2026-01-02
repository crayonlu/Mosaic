/**
 * Glass Card Component
 * Glassmorphism style card with blur effect
 */

import { View, StyleSheet, ViewStyle } from 'react-native'
import { useColor } from '@/hooks/use-color'
import { Spacing, BorderRadius, Shadows } from '@/constants/theme'

interface GlassCardProps {
  children: React.ReactNode
  style?: ViewStyle
  variant?: 'light' | 'medium' | 'heavy'
  rounded?: 'sm' | 'md' | 'lg' | 'xl'
}

export function GlassCard({
  children,
  style,
  variant = 'medium',
  rounded = 'lg',
}: GlassCardProps) {
  const { surfaceGlass, borderLight } = useColor()

  const getShadow = () => {
    switch (variant) {
      case 'light':
        return Shadows.xs
      case 'heavy':
        return Shadows.lg
      default:
        return Shadows.md
    }
  }

  const getBorderRadius = () => {
    switch (rounded) {
      case 'sm':
        return BorderRadius.sm
      case 'md':
        return BorderRadius.md
      case 'lg':
        return BorderRadius.lg
      case 'xl':
        return BorderRadius.xl
    }
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: surfaceGlass,
          borderColor: borderLight,
          borderRadius: getBorderRadius(),
          ...getShadow(),
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: Spacing.md,
    overflow: 'hidden',
  },
})
