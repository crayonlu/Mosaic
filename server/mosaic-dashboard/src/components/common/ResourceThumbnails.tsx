import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '../../lib/api-client'
import type { Resource } from '../../types/api'
import { Image as ImageIcon, Video as VideoIcon } from 'lucide-react'

export function ResourceThumbnails({
  resources,
  className,
  maxImages = 4,
}: {
  resources: Resource[]
  className?: string
  maxImages?: number
}) {
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map())

  const imageResources = useMemo(
    () => resources.filter(r => r.resourceType === 'image'),
    [resources]
  )

  const videoResources = useMemo(
    () => resources.filter(r => r.resourceType === 'video'),
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
          const response = await apiClient.getResource(resource.id)
          const blob = await fetch(response.url).then(res => res.blob())
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

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {displayImages.map((resource, index) => {
          const imageUrl = imageUrls.get(resource.id)
          return (
            <div
              key={resource.id}
              className="relative w-16 h-16 rounded-lg overflow-hidden border bg-muted"
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={resource.filename}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="w-6 h-6" />
                </div>
              )}
            </div>
          )
        })}
        {hasMoreImages && (
          <div className="w-16 h-16 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground text-sm">
            +{imageResources.length - maxImages}
          </div>
        )}
        {videoResources.length > 0 && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground px-2">
            <VideoIcon className="w-4 h-4" />
            <span>视频 {videoResources.length}</span>
          </div>
        )}
      </div>
    </div>
  )
}
