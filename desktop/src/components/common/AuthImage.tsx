import { resourcesApi } from '@mosaic/api'
import { getResourceLoader } from '@mosaic/cache'
import { useEffect, useMemo, useState } from 'react'
import { LoadingSpinner } from '../ui/loading/loading-spinner'

type NativeImgProps = React.ComponentPropsWithoutRef<'img'>

interface AuthImageProps extends NativeImgProps {
  withAuth?: boolean
  variant?: 'original' | 'thumb' | 'opt'
  onLoadingChange?: (isLoading: boolean) => void
}

function isBypassSource(src: string): boolean {
  return src.startsWith('blob:') || src.startsWith('data:')
}

function extractResourceId(url: string): string | null {
  const match = url.match(/\/api\/resources\/([a-f0-9-]+)/i)
  return match ? match[1] : null
}

export function AuthImage({ src, withAuth = true, variant = 'original', onLoadingChange, ...props }: AuthImageProps) {
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
    loadImage()

    return () => {
      controller.abort()
    }
  }, [source, withAuth, variant])

  useEffect(() => {
    onLoadingChange?.(isLoading)
  }, [isLoading, onLoadingChange])

  const { className: classNameRest, ...imgProps } = props

  if (isLoading) {
    return <LoadingSpinner className={classNameRest} {...imgProps} />
  }

  if (hasError || !resolvedSrc) {
    return null
  }

  return <img className={classNameRest} src={resolvedSrc} {...imgProps} />
}
