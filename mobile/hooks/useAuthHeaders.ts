import { useEffect, useState } from 'react'
import { getBearerAuthHeaders } from '@/lib/services/apiAuth'

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

export function useAuthHeaders(): Record<string, string> {
  const [headers, setHeaders] = useState<Record<string, string>>(cachedHeaders ?? {})

  useEffect(() => {
    if (cachedHeaders) {
      // Already cached — ensure state is in sync
      setHeaders(prev => (prev === cachedHeaders ? prev : cachedHeaders!))
      return
    }
    if (!pendingPromise) {
      pendingPromise = getBearerAuthHeaders().then(h => {
        cachedHeaders = h
        pendingPromise = null
        return h
      })
    }
    pendingPromise.then(h => setHeaders(h))
  }, [])

  return headers
}

export function clearAuthHeadersCache() {
  cachedHeaders = null
}
