import { mmkvZustandStorage } from '@/lib/storage/mmkv'
import { useThemeStore } from '@/stores/themeStore'
import { X } from 'lucide-react-native'
import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
  actionLabel?: string
  onAction?: () => void
}

export interface ToastOptions {
  type?: ToastType
  title: string
  message?: string
  duration?: number
  actionLabel?: string
  onAction?: () => void
}

interface ToastState {
  toasts: ToastMessage[]
  showToast: (message: Omit<ToastMessage, 'id'>) => string
  hideToast: (id: string) => void
  clearAll: () => void
}

export const useToastStore = create<ToastState>()(
  persist(
    set => ({
      toasts: [],
      showToast: message => {
        const id = Date.now().toString()
        const toastMessage: ToastMessage = {
          id,
          type: message.type || 'info',
          title: message.title,
          message: message.message,
          duration: message.duration || 3000,
          actionLabel: message.actionLabel,
          onAction: message.onAction,
        }

        set(state => ({
          toasts: [toastMessage, ...state.toasts],
        }))

        // Auto hide after duration
        setTimeout(() => {
          set(state => ({
            toasts: state.toasts.filter(t => t.id !== id),
          }))
        }, message.duration || 3000)

        return id
      },
      hideToast: id =>
        set(state => ({
          toasts: state.toasts.filter(t => t.id !== id),
        })),
      clearAll: () => set({ toasts: [] }),
    }),
    {
      name: 'mosaic-toast-storage',
      storage: createJSONStorage(() => mmkvZustandStorage),
    }
  )
)

export function ToastContainer() {
  const { toasts, hideToast } = useToastStore()
  const theme = useThemeStore().theme

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={styles.centerContainer}>
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onHide={() => hideToast(toast.id)} theme={theme} />
        ))}
      </View>
    </View>
  )
}

function Toast({
  toast,
  onHide,
  theme,
}: {
  toast: ToastMessage
  onHide: () => void
  theme: {
    background: string
    surface: string
    text: string
    textSecondary: string
    success: string
    error: string
    warning: string
    info: string
    border: string
    borderStrong: string
    semantic: {
      successSoft: string
      errorSoft: string
      warningSoft: string
      infoSoft: string
    }
  }
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current

  useEffect(() => {
    // Parallel animations: fade in and scale up
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

    return () => {
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
  }, [toast.id])

  const getSemanticColor = () => {
    switch (toast.type) {
      case 'success':
        return theme.success
      case 'error':
        return theme.error
      case 'warning':
        return theme.warning
      case 'info':
        return theme.info
      default:
        return theme.info
    }
  }

  const semanticColor = getSemanticColor()

  const getSoftSemanticColor = () => {
    switch (toast.type) {
      case 'success':
        return theme.semantic.successSoft
      case 'error':
        return theme.semantic.errorSoft
      case 'warning':
        return theme.semantic.warningSoft
      case 'info':
        return theme.semantic.infoSoft
      default:
        return theme.semantic.infoSoft
    }
  }

  const palette = {
    containerBackground: getSoftSemanticColor(),
    containerBorder: theme.borderStrong,
    iconColor: semanticColor,
    closeBackground: theme.surface,
    actionBorder: semanticColor,
    actionText: semanticColor,
  }

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✓'
      case 'error':
        return '✕'
      case 'warning':
        return '!'
      case 'info':
        return 'i'
      default:
        return '•'
    }
  }

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          backgroundColor: palette.containerBackground,
          borderColor: palette.containerBorder,
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={[styles.icon, { color: palette.iconColor }]}>{getIcon()}</Text>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: theme.text }]}>{toast.title}</Text>
          {toast.message && (
            <Text style={[styles.message, { color: theme.textSecondary }]}>{toast.message}</Text>
          )}
        </View>
      </View>
      <TouchableOpacity
        onPress={onHide}
        style={[styles.closeButton, { backgroundColor: palette.closeBackground }]}
      >
        <X color={theme.text} size={14} />
      </TouchableOpacity>
      {toast.actionLabel && toast.onAction && (
        <TouchableOpacity
          onPress={() => {
            toast.onAction?.()
            onHide()
          }}
          style={[styles.actionButton, { borderColor: palette.actionBorder }]}
        >
          <Text style={[styles.actionText, { color: palette.actionText }]}>
            {toast.actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  )
}

export const toast = {
  show: (options: ToastOptions) => {
    const toastMessage: Omit<ToastMessage, 'id'> = {
      type: options.type || 'info',
      title: options.title,
      message: options.message,
      duration: options.duration || 3000,
      actionLabel: options.actionLabel,
      onAction: options.onAction,
    }
    useToastStore.getState().showToast(toastMessage)
  },
  success: (title: string, message?: string, duration?: number) => {
    toast.show({ type: 'success', title, message, duration })
  },
  error: (title: string, message?: string, duration?: number) => {
    toast.show({ type: 'error', title, message, duration })
  },
  warning: (title: string, message?: string, duration?: number) => {
    toast.show({ type: 'warning', title, message, duration })
  },
  info: (title: string, message?: string, duration?: number) => {
    toast.show({ type: 'info', title, message, duration })
  },
  hide: (id: string) => {
    useToastStore.getState().hideToast(id)
  },
}

const styles = StyleSheet.create({
  centerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastContainer: {
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginVertical: 6,
    maxWidth: 280,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 12,
  },
  icon: {
    fontSize: 14,
    fontWeight: 'bold',
    minWidth: 20,
    textAlign: 'center',
  },
  textContainer: {
    flex: 1,
    minWidth: 120,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'left',
  },
  message: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'left',
    marginTop: 2,
  },
  closeButton: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    position: 'absolute',
    top: -6,
    right: -6,
    borderRadius: 10,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginLeft: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
  },
})
