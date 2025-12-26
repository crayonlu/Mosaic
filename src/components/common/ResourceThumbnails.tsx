import { useState, useEffect, useMemo } from 'react'
import {
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  Volume2,
  MoreHorizontal,
} from 'lucide-react'
import { assetCommands } from '@/utils/callRust'
import { cn } from '@/lib/utils'
import type { Resource } from '@/types/memo'

interface ResourceThumbnailsProps {
  resources: Resource[]
  className?: string
  maxImages?: number
}

export function ResourceThumbnails({
  resources,
  className,
  maxImages = 4,
}: ResourceThumbnailsProps) {
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map())

  const imageResources = useMemo(
    () => resources.filter(r => r.resourceType === 'image'),
    [resources]
  )

  const otherResources = useMemo(
    () => resources.filter(r => r.resourceType !== 'image'),
    [resources]
  )

  const displayImages = useMemo(
    () => imageResources.slice(0, maxImages),
    [imageResources, maxImages]
  )

  const hasMoreImages = imageResources.length > maxImages

  useEffect(() => {
    const loadImages = async () => {
      const newUrls = new Map<string, string>()

      for (const resource of displayImages) {
        try {
          const data = await assetCommands.readImageFile(resource.filename)
          const uint8Array = new Uint8Array(data)
          const blob = new Blob([uint8Array], { type: resource.mimeType })
          const url = URL.createObjectURL(blob)
          newUrls.set(resource.id, url)
        } catch (error) {
          console.error(`加载图片失败 ${resource.filename}:`, error)
        }
      }

      setImageUrls(newUrls)

      return () => {
        newUrls.forEach(url => URL.revokeObjectURL(url))
      }
    }

    if (displayImages.length > 0) {
      loadImages()
    }

    return () => {
      setImageUrls(prev => {
        prev.forEach(url => URL.revokeObjectURL(url))
        return new Map()
      })
    }
  }, [displayImages])

  if (resources.length === 0) {
    return null
  }

  const getResourceIcon = (resourceType: string) => {
    switch (resourceType) {
      case 'image':
        return ImageIcon
      case 'video':
        return VideoIcon
      case 'voice':
        return Volume2
      default:
        return FileText
    }
  }

  const getResourceLabel = (resourceType: string, count: number) => {
    switch (resourceType) {
      case 'image':
        return `图片 ${count}`
      case 'video':
        return `视频 ${count}`
      case 'voice':
        return `音频 ${count}`
      default:
        return `文件 ${count}`
    }
  }

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {displayImages.length > 0 && (
        <div className="flex gap-1">
          {displayImages.map((resource, index) => {
            const url = imageUrls.get(resource.id)
            return (
              <div
                key={resource.id}
                className="relative w-8 h-8 rounded border bg-muted/50 overflow-hidden"
              >
                {url ? (
                  <img src={url} alt={resource.filename} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-muted/50 flex items-center justify-center">
                    <ImageIcon className="w-3 h-3 text-muted-foreground" />
                  </div>
                )}
                {hasMoreImages && index === displayImages.length - 1 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <MoreHorizontal className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {otherResources.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {['video', 'voice', 'file'].map(resourceType => {
            const typeResources = otherResources.filter(r => r.resourceType === resourceType)
            if (typeResources.length === 0) return null

            const Icon = getResourceIcon(resourceType)
            const label = getResourceLabel(resourceType, typeResources.length)

            return (
              <div
                key={resourceType}
                className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground"
              >
                <Icon className="w-3 h-3" />
                <span>{label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
