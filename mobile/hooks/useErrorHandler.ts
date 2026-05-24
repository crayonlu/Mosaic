import { toast } from '@/components/ui/Toast'
import i18n from '@/lib/i18n'
import { useRouter } from 'expo-router'
import { useCallback } from 'react'
import { useConnectionStore } from '../stores/connectionStore'

type ErrorHandler = (error: unknown) => void

export function useErrorHandler(): ErrorHandler {
  const router = useRouter()
  const { isConnected } = useConnectionStore()

  return useCallback(
    (error: unknown) => {
      if (!isConnected) {
        return
      }

      if (typeof error === 'object' && error !== null) {
        const err = error as { status?: number; message?: string }

        if (err.status === 401) {
          router.replace('/setup')
          return
        }

        if (err.status === 403) {
          toast.show({ type: 'error', title: i18n.t('errorHandler.noPermission') })
          return
        }

        if (err.status && err.status >= 500) {
          toast.show({ type: 'error', title: i18n.t('errorHandler.serverError') })
          return
        }
      }
    },
    [router, isConnected]
  )
}
