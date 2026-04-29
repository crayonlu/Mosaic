import { Loader } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getToken } from '../api'

interface AdminImageProps {
  src: string
  alt?: string
  className?: string
  showPlaceholder?: boolean
}

export default function AdminImage({ src, alt = '', className = '', showPlaceholder }: AdminImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    if (!src) return

    ;(async () => {
      try {
        const token = getToken()
        const res = await fetch(src, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        if (mountedRef.current) {
          setBlobUrl(URL.createObjectURL(blob))
        }
      } catch {
        /* silently fail */
      }
    })()

    return () => {
      mountedRef.current = false
    }
  }, [src])

  if (blobUrl) {
    return <img src={blobUrl} alt={alt} className={className} />
  }
  if (showPlaceholder) {
    return (
      <div className="flex items-center justify-center">
        <Loader size={16} className="spin" />
      </div>
    )
  }
  return null
}
