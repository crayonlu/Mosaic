import { toast } from '@/components/ui/Toast'
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
          toast.show({ type: 'error', title: '无权限执行此操作' })
          return
        }

        if (err.status && err.status >= 500) {
          toast.show({ type: 'error', title: '服务器错误' })
          return
        }
      }
    },
    [router, isConnected]
  )
}
