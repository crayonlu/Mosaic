import { useEffect, useMemo, useState } from 'react'
import { LoadingSpinner } from '../ui/loading/loading-spinner'
import { getCachedResource, setCachedResource } from '@/utils/resource-cache'

type NativeImgProps = React.ComponentPropsWithoutRef<'img'>

interface AuthImageProps extends NativeImgProps {
  withAuth?: boolean
}

function isBypassSource(src: string): boolean {
  return src.startsWith('blob:') || src.startsWith('data:')
}

export function AuthImage({ src, withAuth = true, ...props }: AuthImageProps) {
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

    const loadImage = async () => {
      try {
        setIsLoading(true)
        setHasError(false)

        const cachedUrl = await getCachedResource(source, 'images')
        if (cachedUrl) {
          setResolvedSrc(cachedUrl)
          setIsLoading(false)
          return
        }

        const token = localStorage.getItem('accessToken')
        const response = await fetch(source, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Image request failed with status ${response.status}`)
        }

        const blob = await response.blob()

        await setCachedResource(source, blob, 'images')

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
    loadImage()

    return () => {
      controller.abort()
    }
  }, [source, withAuth])

  const { className, ...restProps } = props

  if (isLoading) {
    return (
      <div
        {...restProps}
        className={`w-full h-full flex items-center justify-center ${className || ''}`}
      >
        <LoadingSpinner size="md" />
      </div>
    )
  }

  if (hasError || !resolvedSrc) {
    return (
      <div
        {...restProps}
        className={`w-full h-full flex items-center justify-center bg-muted ${className || ''}`}
      >
        <LoadingSpinner size="md" />
      </div>
    )
  }

  return <img src={resolvedSrc} {...restProps} className={className} />
}
