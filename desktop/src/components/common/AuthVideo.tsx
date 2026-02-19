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
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(
    typeof src === 'string' ? src : undefined
  )

  const [isLoading, setIsLoading] = useState(true)

  const source = useMemo(() => (typeof src === 'string' ? src : undefined), [src])

  useEffect(() => {
    if (!source) {
      setResolvedSrc(undefined)
      setIsLoading(false)
      return
    }

    if (!withAuth || isBypassSource(source)) {
      setResolvedSrc(source)
      setIsLoading(false)
      return
    }

    const token = localStorage.getItem('accessToken')
    if (!token) {
      setResolvedSrc(source)
      setIsLoading(false)
      return
    }

    const controller = new window.AbortController()

    const loadVideo = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(source, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        })

        if (!response.ok) {
          setIsLoading(false)
          throw new Error(`Video request failed with status ${response.status}`)
        }

        const blob = await response.blob()
        const objectUrl = URL.createObjectURL(blob)
        setResolvedSrc(objectUrl)
        setIsLoading(false)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setResolvedSrc(source)
        }
        setIsLoading(false)
      } finally {
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

  return <video src={resolvedSrc} {...restVideoProps} className={className} style={style} />
}
