import '@/lib/solidMedia'
import { cn } from '@/lib/utils'
import { resourcesApi } from '@mosaic/api'
import { useEffect, useMemo } from 'react'

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

function resolveVariantSource(source: string, variant: AuthImageProps['variant']): string {
  const resourceId = extractResourceId(source)
  if (!resourceId || variant === 'original') return source
  return resourcesApi.getDownloadUrl(resourceId, variant)
}

export function AuthImage({
  src,
  withAuth = true,
  variant = 'original',
  onLoadingChange,
  alt,
  className,
  style,
  ...props
}: AuthImageProps) {
  const source = useMemo(() => (typeof src === 'string' ? src : undefined), [src])
  const resolvedSource = useMemo(
    () => (source ? resolveVariantSource(source, variant) : undefined),
    [source, variant]
  )

  useEffect(() => {
    onLoadingChange?.(false)
  }, [onLoadingChange, resolvedSource])

  if (!source || !resolvedSource) {
    return null
  }

  if (!withAuth || isBypassSource(resolvedSource)) {
    return <img src={resolvedSource} alt={alt} className={className} style={style} {...props} />
  }

  return (
    <solid-media
      key={resolvedSource}
      {...(props as React.HTMLAttributes<HTMLElement>)}
      src={resolvedSource}
      type="image"
      alt={alt}
      className={cn(className)}
      style={style}
      data-fill={className ? 'true' : undefined}
    />
  )
}
