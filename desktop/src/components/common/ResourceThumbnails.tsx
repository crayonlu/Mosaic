import { AuthImage } from '@/components/common/AuthImage'
import { resolveApiUrl } from '@/lib/shared-api'
import { cn } from '@/lib/utils'
import type { Resource } from '@mosaic/api'
import { FileText, Image as ImageIcon, MoreHorizontal, Video as VideoIcon } from 'lucide-react'
import { useMemo } from 'react'

interface ResourceThumbnailsProps {
  resources: Resource[]
  className?: string
  maxImages?: number
}

export function ResourceThumbnails({
  resources,
  className,
  maxImages = 9,
}: ResourceThumbnailsProps) {
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

  if (resources.length === 0) {
    return null
  }

  const getResourceIcon = (resourceType: string) => {
    switch (resourceType) {
      case 'image':
        return ImageIcon
      case 'video':
        return VideoIcon
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
      default:
        return `文件 ${count}`
    }
  }

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {displayImages.length > 0 && (
        <div className="flex gap-1">
          {displayImages.map((resource, index) => {
            const url = resolveApiUrl(resource.url)
            return (
              <div
                key={resource.id}
                className="relative w-8 h-8 rounded border bg-muted/50 overflow-hidden"
              >
                {url ? (
                  <AuthImage
                    src={url}
                    alt={resource.filename}
                    className="w-full h-full object-cover"
                  />
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
          {['video', 'file'].map(resourceType => {
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
