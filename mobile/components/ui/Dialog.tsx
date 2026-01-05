import { Animated, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useThemeStore } from '@/stores/theme-store'
import { useEffect, useRef, useState } from 'react'

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
  const scaleAnim = useRef(new Animated.Value(0.9)).current

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 15,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible])

  const handleBackdropPress = () => {
    // Only close if not a critical dialog
    if (type !== 'danger') {
      onClose?.()
    }
  }

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

function getButtonStyle(variant: string, theme: any) {
  switch (variant) {
    case 'danger':
      return {
        backgroundColor: '#EF4444',
        borderColor: 'transparent',
      }
    case 'secondary':
      return {
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
        borderColor: 'rgba(0, 0, 0, 0.1)',
      }
    case 'ghost':
      return {
        backgroundColor: 'transparent',
        borderColor: 'rgba(0, 0, 0, 0.1)',
      }
    default: // primary
      return {
        backgroundColor: theme.primary,
        borderColor: 'transparent',
      }
  }
}

function getButtonTextStyle(variant: string, theme: any) {
  switch (variant) {
    case 'secondary':
      return { color: theme.text }
    case 'ghost':
      return { color: theme.primary }
    default:
      return { color: '#FFFFFF' }
  }
}

export const dialog = {
  confirm: (options: {
    title: string
    message?: string
    onConfirm: () => void
    onCancel?: () => void
    confirmText?: string
    cancelText?: string
    type?: DialogType
  }) => {
    // This will be used with a simple implementation for now
    console.log('dialog.confirm called with:', options)
  },
  alert: (options: { title: string; message?: string; buttonText?: string }) => {
    console.log('dialog.alert called with:', options)
  },
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
    width: '85%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttons: {
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
})
