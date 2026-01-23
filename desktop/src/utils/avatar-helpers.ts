import { useEffect, useRef, useState } from 'react'
import { assetCommands } from './callRust'

const avatarUrlCache = new Map<string, string>()

export async function getAvatarUrl(
  avatarPath?: string | null,
  avatarUrl?: string | null
): Promise<string | undefined> {
  if (avatarUrl) {
    return avatarUrl
  }

  if (!avatarPath) {
    return undefined
  }

  if (avatarUrlCache.has(avatarPath)) {
    return avatarUrlCache.get(avatarPath)
  }

  try {
    const fileData = await assetCommands.readImageFile(avatarPath)
    const uint8Array = new Uint8Array(fileData)

    const ext = avatarPath.split('.').pop()?.toLowerCase()
    let mimeType = 'image/webp'
    if (ext === 'jpg' || ext === 'jpeg') {
      mimeType = 'image/jpeg'
    } else if (ext === 'png') {
      mimeType = 'image/png'
    } else if (ext === 'webp') {
      mimeType = 'image/webp'
    }

    const blob = new Blob([uint8Array], { type: mimeType })
    const blobUrl = URL.createObjectURL(blob)

    avatarUrlCache.set(avatarPath, blobUrl)

    return blobUrl
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
      setUrl(avatarUrl)
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
