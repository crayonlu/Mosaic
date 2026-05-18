import { useThemeStore } from '@/stores/themeStore'
import { ArrowLeft } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'

interface ScreenHeaderProps {
  /** Show a back button that calls router.back(). Default: false */
  showBack?: boolean
  /** Custom back action. Overrides router.back() */
  onBack?: () => void
  /** Title text displayed in the center */
  title?: string
  /** Content for the left slot. Overrides showBack if provided */
  left?: ReactNode
  /** Content for the center slot. Overrides title if provided */
  center?: ReactNode
  /** Content for the right slot */
  right?: ReactNode
  /** Show bottom border. Default: true */
  showBorder?: boolean
  /** Background color override */
  backgroundColor?: string
}

export function ScreenHeader({
  showBack = false,
  onBack,
  title,
  left,
  center,
  right,
  showBorder = true,
  backgroundColor,
}: ScreenHeaderProps) {
  const { theme } = useThemeStore()

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      router.back()
    }
  }

  const renderLeft = () => {
    if (left) return left
    if (showBack) {
      return (
        <Pressable
          onPress={handleBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.slot}
        >
          <ArrowLeft size={22} color={theme.text} strokeWidth={2} />
        </Pressable>
      )
    }
    return <View style={styles.slot} />
  }

  const renderCenter = () => {
    if (center) return center
    if (title) {
      return (
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {title}
        </Text>
      )
    }
    return null
  }

  const renderRight = () => {
    if (right) return right
    return <View style={styles.slot} />
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: backgroundColor ?? theme.background,
          borderBottomColor: theme.border,
          borderBottomWidth: showBorder ? StyleSheet.hairlineWidth : 0,
        },
      ]}
    >
      <View style={styles.left}>{renderLeft()}</View>
      <View style={styles.center}>{renderCenter()}</View>
      <View style={styles.right}>{renderRight()}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  left: {
    alignItems: 'flex-start',
    minWidth: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  right: {
    alignItems: 'flex-end',
    minWidth: 40,
  },
  slot: {
    padding: 4,
    minWidth: 28,
    minHeight: 28,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
})
