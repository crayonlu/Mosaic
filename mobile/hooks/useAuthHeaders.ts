import { useEffect, useState } from 'react'
import { getBearerAuthHeaders } from '@/lib/services/apiAuth'

let cachedHeaders: Record<string, string> | null = null
let pendingPromise: Promise<Record<string, string>> | null = null

export function useAuthHeaders() {
  const [headers, setHeaders] = useState<Record<string, string>>(cachedHeaders ?? {})

  useEffect(() => {
    if (cachedHeaders) {
      setHeaders(cachedHeaders)
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
