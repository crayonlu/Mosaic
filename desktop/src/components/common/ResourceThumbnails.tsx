import { AuthImage } from '@/components/common/AuthImage'
import { resolveApiUrl } from '@/lib/shared-api'
import { cn } from '@/lib/utils'
import type { Resource } from '@mosaic/api'
import { FileText, Image as ImageIcon, MoreHorizontal, Video as VideoIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

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
  const displayResources = useMemo(() => resources.slice(0, maxImages), [resources, maxImages])
  const hasMoreResources = resources.length > maxImages
  const [videoThumbnailLoading, setVideoThumbnailLoading] = useState<Record<string, boolean>>({})

  if (resources.length === 0) {
    return null
  }

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {displayResources.length > 0 && (
        <div className="flex gap-1">
          {displayResources.map((resource, index) => {
            const previewUrl = resolveApiUrl(
              resource.resourceType === 'video' ? resource.thumbnailUrl : resource.url
            )
            return (
              <div
                key={resource.id}
                className="relative w-8 h-8 rounded border bg-muted/50 overflow-hidden"
              >
                {previewUrl ? (
                  <AuthImage
                    src={previewUrl}
                    alt={resource.filename}
                    onLoadingChange={(isLoading) => {
                      if (resource.resourceType !== 'video') {
                        return
                      }

                      setVideoThumbnailLoading((prev) => {
                        if (prev[resource.id] === isLoading) {
                          return prev
                        }

                        return {
                          ...prev,
                          [resource.id]: isLoading,
                        }
                      })
                    }}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted/50 flex items-center justify-center">
                    {resource.resourceType === 'video' ? (
                      <VideoIcon className="w-3 h-3 text-muted-foreground" />
                    ) : resource.resourceType === 'image' ? (
                      <ImageIcon className="w-3 h-3 text-muted-foreground" />
                    ) : (
                      <FileText className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                )}
                {resource.resourceType === 'video' && previewUrl && videoThumbnailLoading[resource.id] === false && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/15">
                    <VideoIcon className="w-3 h-3 text-white" />
                  </div>
                )}
                {hasMoreResources && index === displayResources.length - 1 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <MoreHorizontal className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
