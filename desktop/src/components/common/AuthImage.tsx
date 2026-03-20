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

const srcCache = new Map<string, string>()
const loadingPromises = new Map<string, Promise<string | null>>()

export function AuthImage({
  src,
  withAuth = true,
  variant = 'original',
  onLoadingChange,
  ...props
}: AuthImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(() => {
    if (typeof src === 'string' && srcCache.has(src)) {
      return srcCache.get(src)
    }
    return undefined
  })

  const [isLoading, setIsLoading] = useState(() => {
    if (typeof src === 'string' && srcCache.has(src)) {
      return false
    }
    return true
  })
  const [hasError, setHasError] = useState(false)

  const source = useMemo(() => (typeof src === 'string' ? src : undefined), [src])

  useEffect(() => {
    if (!source) {
      setResolvedSrc(undefined)
      setIsLoading(false)
      setHasError(false)
      return
    }

    if (srcCache.has(source)) {
      setResolvedSrc(srcCache.get(source))
      setIsLoading(false)
      setHasError(false)
      return
    }

    if (!withAuth || isBypassSource(source)) {
      srcCache.set(source, source)
      setResolvedSrc(source)
      setIsLoading(false)
      setHasError(false)
      return
    }

    let cancelled = false

    const loadImage = async () => {
      try {
        setIsLoading(true)
        setHasError(false)

        const resourceId = extractResourceId(source)
        let urlToLoad = source

        if (resourceId && variant !== 'original') {
          const variantUrl = resourcesApi.getDownloadUrl(resourceId, variant)
          urlToLoad = variantUrl
        }

        if (loadingPromises.has(urlToLoad)) {
          const cachedPromise = loadingPromises.get(urlToLoad)!
          const result = await cachedPromise
          if (!cancelled) {
            if (result) {
              srcCache.set(source, result)
              setResolvedSrc(result)
            } else {
              setHasError(true)
            }
            setIsLoading(false)
          }
          return
        }

        const promise = (async () => {
          const loader = await getResourceLoader()
          if (!loader) {
            return null
          }
          const result = await loader.load(urlToLoad, { forceRefresh: false, allowCache: true })

          if (result.path) {
            return result.path
          }

          if (result.data) {
            const blob = new Blob([result.data])
            return URL.createObjectURL(blob)
          }

          return null
        })()

        loadingPromises.set(urlToLoad, promise)

        const result = await promise
        loadingPromises.delete(urlToLoad)

        if (cancelled) return

        if (result) {
          srcCache.set(source, result)
          setResolvedSrc(result)
        } else {
          setHasError(true)
        }
        setIsLoading(false)
      } catch (error) {
        if ((error as Error).name !== 'AbortError' && !cancelled) {
          setHasError(true)
        }
        setIsLoading(false)
      }
    }
    loadImage()

    return () => {
      cancelled = true
    }
  }, [source, withAuth, variant])

  useEffect(() => {
    onLoadingChange?.(isLoading)
  }, [isLoading, onLoadingChange])

  const { className: classNameRest, ...imgProps } = props

  if (isLoading) {
    return (
      <div className="flex justify-center items-center">
        <LoadingSpinner className={classNameRest} {...imgProps} />
      </div>
    )
  }

  if (hasError || !resolvedSrc) {
    return null
  }

  return <img className={classNameRest} src={resolvedSrc} {...imgProps} />
}
