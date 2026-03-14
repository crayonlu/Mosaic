import { getResourceLoader } from '@mosaic/cache'
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

        const loader = await getResourceLoader()
        const result = await loader.load(source, { forceRefresh: false, allowCache: true })
        
        if (result.path) {
          setResolvedSrc(result.path)
          setIsLoading(false)
          return
        }

        if (result.data) {
          const blob = new Blob([result.data])
          const objectUrl = URL.createObjectURL(blob)
          setResolvedSrc(objectUrl)
          setIsLoading(false)
          return
        }

        setHasError(true)
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
        className={`w-full h-full flex items-center justify-center ${className || ''}`}
      >
        <LoadingSpinner size="md" />
      </div>
    )
  }

  return (
    <video
      className={className}
      style={style}
      src={resolvedSrc}
      {...restVideoProps}
    />
  )
}
