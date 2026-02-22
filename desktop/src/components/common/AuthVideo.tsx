import { getCachedResource, setCachedResource } from '@/utils/resource-cache'
import { apiClient } from '@mosaic/api'
import { useEffect, useMemo, useState } from 'react'
import { LoadingSpinner } from '../ui/loading/loading-spinner'

type NativeVideoProps = React.ComponentPropsWithoutRef<'video'>

interface AuthVideoProps extends NativeVideoProps {
  withAuth?: boolean
}

function isBypassSource(src: string): boolean {
  return src.startsWith('blob:') || src.startsWith('data:')
}

export function AuthVideo({ src, withAuth = true, ...props }: AuthVideoProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(undefined)

  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const source = useMemo(() => (typeof src === 'string' ? src : undefined), [src])

  useEffect(() => {
    if (!source) {
      setResolvedSrc(undefined)
      setIsLoading(false)
      setHasError(false)
      return
    }

    if (!withAuth || isBypassSource(source)) {
      setResolvedSrc(source)
      setIsLoading(false)
      setHasError(false)
      return
    }

    const controller = new window.AbortController()

    const loadVideo = async () => {
      try {
        setIsLoading(true)
        setHasError(false)

        const cachedUrl = await getCachedResource(source, 'videos')
        if (cachedUrl) {
          setResolvedSrc(cachedUrl)
          setIsLoading(false)
          return
        }

        const token = await apiClient.getTokenStorage()?.getAccessToken()
        const response = await fetch(source, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Video request failed with status ${response.status}`)
        }

        const blob = await response.blob()

        await setCachedResource(source, blob, 'videos')

        const objectUrl = URL.createObjectURL(blob)
        setResolvedSrc(objectUrl)
        setIsLoading(false)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setHasError(true)
        }
        setIsLoading(false)
      }
    }
    loadVideo()

    return () => {
      controller.abort()
    }
  }, [source, withAuth])

  const { className, style, ...restVideoProps } = props

  if (isLoading) {
    return (
      <div
        style={style}
        className={`w-full h-full flex items-center justify-center ${className || ''}`}
      >
        <LoadingSpinner size="md" />
      </div>
    )
  }

  if (hasError || !resolvedSrc) {
    return (
      <div
        style={style}
        className={`w-full h-full flex items-center justify-center bg-muted ${className || ''}`}
      >
        <LoadingSpinner size="md" />
      </div>
    )
  }

  return <video src={resolvedSrc} {...restVideoProps} className={className} style={style} />
}
