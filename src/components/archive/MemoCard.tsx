import { memo } from 'react'
import dayjs from 'dayjs'
import { Image as ImageIcon, Video as VideoIcon, FileText, Volume2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { RichTextEditor } from '@/components/common/RichTextEditor'
import type { MemoWithResources } from '@/types/memo'
import { cn } from '@/lib/utils'

interface MemoCardProps {
  memo: MemoWithResources
  mode: 'view' | 'select'
  selected: boolean
  onSelect: (memoId: string, selected: boolean) => void
  onClick: () => void
}

export const MemoCard = memo<MemoCardProps>(({ memo, mode, selected, onSelect, onClick }) => {
  const getResourcePreview = () => {
    const images = memo.resources.filter(r => r.resourceType === 'image')
    const videos = memo.resources.filter(r => r.resourceType === 'video')
    const audios = memo.resources.filter(r => r.resourceType === 'voice')
    const files = memo.resources.filter(r => r.resourceType === 'file')

    const previews = []
    if (images.length > 0) previews.push({ icon: ImageIcon, count: images.length, label: '图片' })
    if (videos.length > 0) previews.push({ icon: VideoIcon, count: videos.length, label: '视频' })
    if (audios.length > 0) previews.push({ icon: Volume2, count: audios.length, label: '音频' })
    if (files.length > 0) previews.push({ icon: FileText, count: files.length, label: '文件' })

    return previews
  }

  const resourcePreviews = getResourcePreview()
  const timeDisplay = dayjs(memo.createdAt).format('HH:mm')

  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card text-sm text-card-foreground shadow-sm transition-all cursor-pointer",
        mode === 'select' && "hover:border-primary/30",
        mode === 'view' && "hover:shadow-md hover:border-primary/50",
        selected && "ring-2 ring-primary/50 border-primary"
      )}
      onClick={() => {
        if (mode === 'select') {
          onSelect(memo.id, !selected)
        } else {
          onClick()
        }
      }}
    >
      {mode === 'select' && (
        <div className="absolute top-3 left-3 z-10">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelect(memo.id, checked as boolean)}
            onClick={(e) => e.stopPropagation()}
          />
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
              <div className="text-muted-foreground italic">无文字内容</div>
            )}

            {resourcePreviews.length > 0 && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {resourcePreviews.map((preview, index) => {
                  const Icon = preview.icon
                  return (
                    <div
                      key={index}
                      className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2 py-1 text-xs text-muted-foreground"
                    >
                      <Icon className="h-3 w-3" />
                      <span>{preview.count}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {memo.tags && memo.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {memo.tags.slice(0, 3).map((tag, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="text-xs px-2 py-0.5"
                  >
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

          <div className="text-xs text-muted-foreground shrink-0">
            {timeDisplay}
          </div>
        </div>
      </div>
    </div>
  )
})

MemoCard.displayName = 'MemoCard'


