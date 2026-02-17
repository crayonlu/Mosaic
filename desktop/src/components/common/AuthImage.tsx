import { useEffect, useMemo, useState } from 'react'
import { LoadingSpinner } from '../ui/loading/loading-spinner'

type NativeImgProps = React.ComponentPropsWithoutRef<'img'>

interface AuthImageProps extends NativeImgProps {
  withAuth?: boolean
}

function isBypassSource(src: string): boolean {
  return src.startsWith('blob:') || src.startsWith('data:')
}

export function AuthImage({ src, withAuth = true, ...props }: AuthImageProps) {
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

    let objectUrl: string | null = null
    const controller = new window.AbortController()

    const loadImage = async () => {
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
          throw new Error(`Image request failed with status ${response.status}`)
        }

        const blob = await response.blob()
        objectUrl = URL.createObjectURL(blob)
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
    loadImage()
  }, [source, withAuth])

  const { className, ...restProps } = props

  if (isLoading) {
    return (
      <div {...restProps} className={`w-full h-full flex items-center justify-center ${className || ''}`}>
        <LoadingSpinner size="md" />
      </div>
    )
  }

  return <img src={resolvedSrc} {...restProps} className={className} />
}