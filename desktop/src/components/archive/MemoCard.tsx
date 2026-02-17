import { MemoImageGrid } from '@/components/common/MemoImageGrid'
import { RichTextEditor } from '@/components/common/RichTextEditor'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { resolveApiUrl } from '@/lib/shared-api'
import { cn } from '@/lib/utils'
import type { MemoWithResources } from '@/types/memo'
import dayjs from 'dayjs'
import { Archive, X } from 'lucide-react'
import { memo, useMemo } from 'react'

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
    const mediaResources = useMemo(() => {
      return memo.resources.filter(r => r.resourceType === 'image')
    }, [memo.resources])

    const imageUrls = useMemo(() => {
      const urls = new Map<string, string>()
      mediaResources.forEach(resource => {
        const imageUrl = resolveApiUrl(resource.url)
        if (imageUrl) {
          urls.set(resource.id, imageUrl)
        }
      })
      return urls
    }, [mediaResources])

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

              {mediaResources.length > 0 && (
                <MemoImageGrid
                  resources={mediaResources}
                  imageUrls={imageUrls}
                  isEditing={false}
                />
              )}

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
