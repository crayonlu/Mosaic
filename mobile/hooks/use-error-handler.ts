import { useCallback } from 'react'
import { useRouter } from 'expo-router'
import { useConnectionStore } from '../stores/connection-store'

type ErrorHandler = (error: unknown) => void

export function useErrorHandler(): ErrorHandler {
  const router = useRouter()
  const { isConnected } = useConnectionStore()

  return useCallback((error: unknown) => {
    if (!isConnected) {
      return
    }

    if (typeof error === 'object' && error !== null) {
      const err = error as { status?: number; message?: string }
      
      if (err.status === 401) {
        router.replace('/setup')
        return
      }
    }
  }, [router, isConnected])
}
