import { ImageBroken } from "@phosphor-icons/react"
import { useEffect, useState, type ReactNode } from "react"
import { getServerUrl, getToken, refreshAccessToken } from "../api"
import { cn } from "../lib/utils"

const blobCache = new Map<string, Promise<Blob>>()

function resolveMediaUrl(src: string): string {
  if (src.startsWith("/")) {
    const server = getServerUrl()
    return server ? `${server}${src}` : src
  }
  return src
}

function isProxySource(src: string, resolved: string): boolean {
  if (src.startsWith("/")) return true
  try {
    const url = new URL(resolved)
    if (url.origin === window.location.origin) return true
    const server = getServerUrl()
    if (server) {
      try {
        if (url.origin === new URL(server).origin) return true
      } catch {
        // fall through to path check
      }
    }
    return /^\/api\/(resources|avatars)\//.test(url.pathname)
  } catch {
    return true
  }
}

async function fetchBlob(url: string): Promise<Blob> {
  const token = getToken()
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (res.status === 401) {
    const fresh = await refreshAccessToken()
    if (!fresh) throw new Error("HTTP 401")
    const retry = await fetch(url, {
      headers: { Authorization: `Bearer ${fresh}` },
    })
    if (!retry.ok) throw new Error(`HTTP ${retry.status}`)
    return retry.blob()
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.blob()
}

function getBlob(url: string): Promise<Blob> {
  let p = blobCache.get(url)
  if (!p) {
    p = fetchBlob(url)
    blobCache.set(url, p)
    p.catch(() => blobCache.delete(url))
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
  const url = resolveMediaUrl(src)
  const proxy = isProxySource(src, url)
  const [loaded, setLoaded] = useState<{ src: string; url: string } | null>(
    null
  )
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!proxy) return
    let objectUrl: string | null = null
    let cancelled = false
    getBlob(url)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setLoaded({ src: url, url: objectUrl })
      })
      .catch(() => {
        if (!cancelled) setFailedSrc(url)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url, proxy])

  const loading = proxy && loaded?.src !== url && failedSrc !== url
  const failed = proxy && failedSrc === url
  const effectiveSrc = proxy ? (loaded?.src === url ? loaded.url : null) : url

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
