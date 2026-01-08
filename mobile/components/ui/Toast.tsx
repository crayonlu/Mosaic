import { useThemeStore } from '@/stores/theme-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
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
      storage: createJSONStorage(() => AsyncStorage),
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

function Toast({ toast, onHide, theme }: { toast: ToastMessage; onHide: () => void; theme: any }) {
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

  const getBackgroundColor = () => {
    switch (toast.type) {
      case 'success':
        return '#10B981'
      case 'error':
        return '#EF4444'
      case 'warning':
        return '#F59E0B'
      case 'info':
        return '#3B82F6'
      default:
        return '#6B7280'
    }
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
          backgroundColor: getBackgroundColor(),
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <TouchableOpacity onPress={onHide} style={styles.closeButton}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
      <View style={styles.content}>
        <Text style={styles.icon}>{getIcon()}</Text>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: '#FFFFFF' }]}>{toast.title}</Text>
          {toast.message && (
            <Text style={[styles.message, { color: 'rgba(255,255,255,0.9)' }]}>
              {toast.message}
            </Text>
          )}
        </View>
      </View>
      {toast.actionLabel && toast.onAction && (
        <TouchableOpacity
          onPress={() => {
            toast.onAction?.()
            onHide()
          }}
          style={[styles.actionButton, { borderColor: 'rgba(255, 255, 255, 0.3)' }]}
        >
          <Text style={styles.actionText}>{toast.actionLabel}</Text>
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
    padding: 12,
    borderRadius: 12,
    elevation: 4,
    marginVertical: 8,
    maxWidth: 320,
  },
  content: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    minWidth: 20,
    textAlign: 'center',
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
    textAlign: 'center',
  },
  message: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: 'bold',
  },
  actionButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
})
