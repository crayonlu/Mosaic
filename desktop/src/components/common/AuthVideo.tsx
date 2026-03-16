import { resourcesApi } from '@mosaic/api'
import { getResourceLoader } from '@mosaic/cache'
import { useEffect, useMemo, useState } from 'react'
import { LoadingSpinner } from '../ui/loading/loading-spinner'

type NativeVideoProps = React.ComponentPropsWithoutRef<'video'>

interface AuthVideoProps extends NativeVideoProps {
  withAuth?: boolean
  variant?: 'original' | 'thumb' | 'opt'
}

function isBypassSource(src: string): boolean {
  return src.startsWith('blob:') || src.startsWith('data:')
}

function extractResourceId(url: string): string | null {
  const match = url.match(/\/api\/resources\/([a-f0-9-]+)/i)
  return match ? match[1] : null
}

export function AuthVideo({
  src,
  withAuth = true,
  variant = 'original',
  ...props
}: AuthVideoProps) {
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

        const resourceId = extractResourceId(source)

        if (resourceId && variant !== 'original') {
          const variantUrl = resourcesApi.getDownloadUrl(resourceId, variant)
          const loader = await getResourceLoader()
          const result = await loader.load(variantUrl, { forceRefresh: false, allowCache: true })

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
        }

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
  }, [source, withAuth, variant])

  const { className, style, ...restVideoProps } = props

  if (isLoading) {
    return (
      <div className="min-w-16 min-h-16 flex justify-center items-center">
        <LoadingSpinner className={className} />
      </div>
    )
  }

  if (hasError || !resolvedSrc) {
    return null
  }

  return <video className={className} style={style} src={resolvedSrc} {...restVideoProps} />
}
