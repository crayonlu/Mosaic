import { ImageBroken } from "@phosphor-icons/react"
import { useEffect, useState, type ReactNode } from "react"
import { getToken, isProxyMediaUrl } from "../api"
import { cn } from "../lib/utils"

const blobCache = new Map<string, Promise<Blob>>()

function fetchBlob(src: string): Promise<Blob> {
  let p = blobCache.get(src)
  if (!p) {
    p = (async () => {
      const res = await fetch(src, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.blob()
    })()
    blobCache.set(src, p)
    p.catch(() => blobCache.delete(src))
  }
  return p
}

interface AuthImageProps {
  src: string
  alt?: string
  className?: string
  placeholder?: ReactNode
  fallback?: ReactNode
}

export default function AuthImage({
  src,
  alt = "",
  className,
  placeholder,
  fallback,
}: AuthImageProps) {
  const proxy = isProxyMediaUrl(src)
  const [loaded, setLoaded] = useState<{ src: string; url: string } | null>(
    null
  )
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!proxy) return
    let objectUrl: string | null = null
    let cancelled = false
    fetchBlob(src)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setLoaded({ src, url: objectUrl })
      })
      .catch(() => {
        if (!cancelled) setFailedSrc(src)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src, proxy])

  const loading = proxy && loaded?.src !== src && failedSrc !== src
  const failed = proxy && failedSrc === src
  const effectiveSrc = proxy ? (loaded?.src === src ? loaded.url : null) : src

  if (loading) {
    return placeholder !== undefined ? (
      <>{placeholder}</>
    ) : (
      <div className={cn("animate-pulse bg-subtle", className)} />
    )
  }

  if (failed || !effectiveSrc) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-subtle text-ink-tertiary",
          className
        )}
      >
        {fallback ?? <ImageBroken size={16} />}
      </div>
    )
  }

  return <img src={effectiveSrc} alt={alt} className={className} />
}
