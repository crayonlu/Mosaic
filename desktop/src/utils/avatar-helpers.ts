import { resolveApiUrl } from '@/lib/shared-api'
import { useEffect, useRef, useState } from 'react'

const avatarUrlCache = new Map<string, string>()

export async function getAvatarUrl(
  avatarPath?: string | null,
  avatarUrl?: string | null
): Promise<string | undefined> {
  if (avatarUrl) {
    return resolveApiUrl(avatarUrl)
  }

  if (!avatarPath) {
    return undefined
  }

  if (avatarUrlCache.has(avatarPath)) {
    return avatarUrlCache.get(avatarPath)
  }

  try {
    const resolvedUrl = resolveApiUrl(avatarPath)
    if (resolvedUrl) {
      avatarUrlCache.set(avatarPath, resolvedUrl)
    }
    return resolvedUrl
  } catch (error) {
    console.error('Failed to load avatar:', error)
    return undefined
  }
}

export function useAvatarUrl(
  avatarPath?: string | null,
  avatarUrl?: string | null
): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() => {
    if (avatarUrl) return avatarUrl
    if (avatarPath && avatarUrlCache.has(avatarPath)) return avatarUrlCache.get(avatarPath)
    return undefined
  })

  const previousPathRef = useRef<string | null | undefined>(avatarPath)
  const previousUrlRef = useRef<string | null | undefined>(avatarUrl)

  useEffect(() => {
    if (previousPathRef.current === avatarPath && previousUrlRef.current === avatarUrl) {
      return
    }

    previousPathRef.current = avatarPath
    previousUrlRef.current = avatarUrl

    if (avatarUrl) {
      setUrl(resolveApiUrl(avatarUrl))
      return
    }

    if (!avatarPath) {
      setUrl(undefined)
      return
    }

    if (avatarUrlCache.has(avatarPath)) {
      setUrl(avatarUrlCache.get(avatarPath))
      return
    }

    getAvatarUrl(avatarPath, avatarUrl)
      .then(newUrl => {
        setUrl(newUrl)
      })
      .catch(error => {
        console.error('Failed to load avatar:', error)
        setUrl(undefined)
      })
  }, [avatarPath, avatarUrl])

  return url
}
