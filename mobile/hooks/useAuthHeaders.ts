import { getBearerAuthHeaders } from '@/lib/services/apiAuth'
import { useEffect, useRef, useState } from 'react'

let cachedHeaders: Record<string, string> | null = null
let pendingPromise: Promise<Record<string, string>> | null = null

/**
 * Pre-warm the auth headers cache. Call this early in app bootstrap
 * so that by the time MemoCards mount, headers are already cached.
 */
export function preloadAuthHeaders() {
  if (cachedHeaders || pendingPromise) return
  pendingPromise = getBearerAuthHeaders().then(h => {
    cachedHeaders = h
    pendingPromise = null
    return h
  })
}

export function useAuthHeaders(): { headers: Record<string, string>; ready: boolean } {
  const [headers, setHeaders] = useState<Record<string, string>>(cachedHeaders ?? {})
  const [ready, setReady] = useState(!!cachedHeaders)
  const unmountedRef = useRef(false)

  useEffect(() => {
    unmountedRef.current = false

    if (cachedHeaders) {
      if (!ready) setReady(true)
      return
    }
    if (!pendingPromise) {
      pendingPromise = getBearerAuthHeaders().then(h => {
        cachedHeaders = h
        pendingPromise = null
        return h
      })
    }
    pendingPromise.then(h => {
      if (!unmountedRef.current) {
        setHeaders(h)
        setReady(true)
      }
    })

    return () => {
      unmountedRef.current = true
    }
  }, [ready])

  return { headers, ready }
}

export function clearAuthHeadersCache() {
  cachedHeaders = null
}
