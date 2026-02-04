import type { Theme } from '@/constants/theme'
import { DarkTheme } from '@/constants/theme'
import { useThemeStore } from '@/stores/theme-store'
import React, { useCallback, useEffect, useRef } from 'react'
import { Animated, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export type DialogType = 'alert' | 'confirm' | 'info' | 'warning' | 'danger'

export interface DialogButton {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
}

export interface DialogProps {
  visible: boolean
  type?: DialogType
  title: string
  message?: string
  buttons: DialogButton[]
  onClose?: () => void
}

const TYPE_STYLES = {
  alert: {
    icon: '!',
    backgroundColor: '#3B82F6',
  },
  confirm: {
    icon: '?',
    backgroundColor: '#F59E0B',
  },
  info: {
    icon: 'i',
    backgroundColor: '#3B82F6',
  },
  warning: {
    icon: '!',
    backgroundColor: '#F59E0B',
  },
  danger: {
    icon: '✕',
    backgroundColor: '#EF4444',
  },
}

export function Dialog({ visible, type = 'info', title, message, buttons, onClose }: DialogProps) {
  const theme = useThemeStore().theme
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current

  useEffect(() => {
    if (visible) {
      // Fade in and scale up
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      // Fade out and scale down
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const handleBackdropPress = useCallback(() => {
    // Only close if not a critical dialog
    if (type !== 'danger') {
      onClose?.()
    }
  }, [type, onClose])

  const typeStyle = TYPE_STYLES[type]

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleBackdropPress}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleBackdropPress} />

        <Animated.View
          style={[
            styles.container,
            {
              backgroundColor: theme.card,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Type Icon */}
          <View style={styles.iconContainer}>
            <View style={[styles.icon, { backgroundColor: typeStyle.backgroundColor }]}>
              <Text style={styles.iconText}>{typeStyle.icon}</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>

          {/* Message */}
          {message && (
            <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
          )}

          {/* Buttons */}
          <View style={styles.buttons}>
            {buttons.map((button, index) => {
              const variant = button.variant || 'primary'
              const buttonStyle = getButtonStyle(variant, theme)
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.button, buttonStyle]}
                  onPress={() => {
                    button.onPress()
                    onClose?.()
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.buttonText, getButtonTextStyle(variant, theme)]}>
                    {button.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

function getButtonStyle(variant: string, theme: Theme) {
  switch (variant) {
    case 'danger':
      return {
        backgroundColor: DarkTheme.primary,
        borderColor: 'transparent',
      }
    case 'secondary':
      return {
        backgroundColor: DarkTheme.surface,
        borderColor: DarkTheme.border,
      }
    case 'ghost':
      return {
        backgroundColor: 'transparent',
        borderColor: DarkTheme.border,
      }
    default: // primary
      return {
        backgroundColor: theme.primary,
        borderColor: 'transparent',
      }
  }
}

function getButtonTextStyle(variant: string, theme: Theme) {
  switch (variant) {
    case 'secondary':
      return { color: theme.text }
    case 'ghost':
      return { color: theme.primary }
    default:
      return { color: '#FFFFFF' }
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    width: '80%',
    maxWidth: 380,
    borderRadius: 16,
    padding: 20,
    elevation: 8,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttons: {
    gap: 8,
    display: 'flex',
    flexDirection: 'row',
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
})
