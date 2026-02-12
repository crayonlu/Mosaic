import { RichTextEditor } from '@/components/common/RichTextEditor'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { MemoWithResources } from '@/types/memo'
import { assetCommands } from '@/utils/callRust'
import dayjs from 'dayjs'
import { Archive, Image as ImageIcon, Video as VideoIcon, X } from 'lucide-react'
import { memo, useEffect, useState } from 'react'

interface MemoCardProps {
  memo: MemoWithResources
  mode: 'view' | 'select'
  selected: boolean
  onSelect: (memoId: string, selected: boolean) => void
  onClick: () => void
  onUnarchive?: (memoId: string) => void
}

export const MemoCard = memo<MemoCardProps>(
  ({ memo, mode, selected, onSelect, onClick, onUnarchive }) => {
    const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map())

    useEffect(() => {
      const loadImages = async () => {
        const newImageUrls = new Map<string, string>()

        for (const resource of memo.resources) {
          if (resource.resourceType === 'image') {
            try {
              const url = await assetCommands.getPresignedImageUrl(resource.id)
              newImageUrls.set(resource.id, url)
            } catch (error) {
              console.error(`加载图片失败 ${resource.id}:`, error)
            }
          }
        }

        setImageUrls(newImageUrls)
      }

      loadImages()

      return () => {
        imageUrls.forEach(url => {
          if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url)
          }
        })
      }
    }, [memo.resources])

    const getMediaResources = () => {
      return memo.resources.filter(r => r.resourceType === 'image')
    }

    const renderMediaGrid = () => {
      const mediaResources = getMediaResources()
      if (mediaResources.length === 0) return null

      const count = mediaResources.length

      let gridClass = ''
      let itemClass = ''

      if (count === 1) {
        gridClass = 'grid-cols-1'
        itemClass = 'aspect-square'
      } else if (count === 2) {
        gridClass = 'grid-cols-2'
        itemClass = 'aspect-square'
      } else if (count === 3) {
        gridClass = 'grid-cols-3'
        itemClass = 'aspect-square'
      } else if (count === 4) {
        gridClass = 'grid-cols-2'
        itemClass = 'aspect-square'
      } else {
        gridClass = 'grid-cols-3'
        itemClass = 'aspect-square'
      }

      return (
        <div className={`mt-3 grid ${gridClass} gap-1 rounded-lg overflow-hidden`}>
          {mediaResources.slice(0, 9).map((resource, index) => {
            const imageUrl = imageUrls.get(resource.id)

            return (
              <div
                key={resource.id}
                className={`relative ${itemClass} bg-muted flex items-center justify-center group`}
              >
                {resource.resourceType === 'image' ? (
                  imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={resource.filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground relative">
                    <VideoIcon className="h-8 w-8" />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <div className="w-6 h-6 bg-white/80 rounded-full flex items-center justify-center">
                        <div className="w-0 h-0 border-l-2 border-l-black border-t border-t-transparent border-b border-b-transparent ml-0.5" />
                      </div>
                    </div>
                  </div>
                )}
                {count > 9 && index === 8 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white font-medium">+{count - 9}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )
    }

    const timeDisplay = dayjs.utc(memo.createdAt).local().format('HH:mm')

    const isArchived = memo.isArchived

    return (
      <div
        className={cn(
          'group relative rounded-lg border bg-card text-sm text-card-foreground transition-all',
          mode === 'select' && !isArchived && 'hover:border-primary/30 cursor-pointer',
          mode === 'view' && !isArchived && 'hover:border-primary/50 cursor-pointer',
          selected && 'ring-2 ring-primary/50 border-primary',
          isArchived && 'opacity-60 cursor-pointer hover:opacity-80 transition-all'
        )}
        onClick={() => {
          if (mode === 'select') {
            if (isArchived) return
            onSelect(memo.id, !selected)
          } else {
            onClick()
          }
        }}
      >
        {mode === 'select' && !isArchived && (
          <div className="absolute top-3 left-3 z-10">
            <Checkbox
              checked={selected}
              onCheckedChange={checked => onSelect(memo.id, checked as boolean)}
              onClick={e => e.stopPropagation()}
            />
          </div>
        )}

        {isArchived && (
          <div className="absolute top-2 right-2 z-20">
            <div className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md px-2.5 py-1 text-xs font-semibold border border-primary/20 group-hover:bg-primary/90 transition-colors">
              <Archive className="h-3.5 w-3.5" />
              <span>已归档</span>
              {mode === 'select' && (
                <X
                  className="h-3 w-3 opacity-60 hover:opacity-100 transition-opacity cursor-pointer hover:scale-110"
                  onClick={e => {
                    e.stopPropagation()
                    if (onUnarchive) onUnarchive(memo.id)
                  }}
                />
              )}
            </div>
          </div>
        )}

        <div className="p-4">
          <div className="flex items-start gap-3">
            {mode === 'select' && <div className="w-5 shrink-0" />}

            <div className="flex-1 min-w-0">
              {memo.content ? (
                <div className="prose-sm prose-p:my-1 prose-headings:my-1 prose-ul:my-1 prose-ol:my-1 max-w-none">
                  <RichTextEditor
                    content={memo.content}
                    onChange={() => {}}
                    editable={false}
                    className="text-sm"
                  />
                </div>
              ) : (
                <></>
              )}

              {renderMediaGrid()}

              {memo.tags && memo.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {memo.tags.slice(0, 3).map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs px-2 py-0.5">
                      {tag}
                    </Badge>
                  ))}
                  {memo.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs px-2 py-0.5">
                      +{memo.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground shrink-0">{timeDisplay}</div>
          </div>
        </div>
      </div>
    )
  }
)

MemoCard.displayName = 'MemoCard'
