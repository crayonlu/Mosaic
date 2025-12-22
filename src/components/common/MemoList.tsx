import { memoCommands } from '@/utils/callRust'
import type { MemoWithResources } from '@/types/memo'
import { useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react'
import { Image as ImageIcon, Video as VideoIcon, FileText, Volume2 } from 'lucide-react'
import { RichTextEditor } from '@/components/common/RichTextEditor'

interface MemoListProps {
  date: string
  className?: string
  onMemoClick?: (memo: MemoWithResources) => void
}

export interface MemoListRef {
  refetch: () => Promise<void>
}

export const MemoList = forwardRef<MemoListRef, MemoListProps>(
  ({ date, className, onMemoClick }, ref) => {
    const [memos, setMemos] = useState<MemoWithResources[]>([])
    const [loading, setLoading] = useState(true)

    const fetchMemos = useCallback(async () => {
      try {
        setLoading(true)
        const data = await memoCommands.getMemosByDate(date)
        setMemos(data)
      } catch (error) {
        console.error('获取memos失败:', error)
      } finally {
        setLoading(false)
      }
    }, [date])

    useImperativeHandle(ref, () => ({
      refetch: fetchMemos,
    }), [fetchMemos])

    useEffect(() => {
      fetchMemos()
    }, [fetchMemos])

    const getResourcePreview = (memo: MemoWithResources) => {
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


    if (loading) {
      return (
        <div className={`${className} flex items-center justify-center py-4`}>
          <div className="text-sm text-muted-foreground">加载中...</div>
        </div>
      )
    }

    if (memos.length === 0) {
      return null
    }

    return (
      <div className={className}>
        <div className="space-y-2">
          {memos.map((memo) => {
            const resourcePreviews = getResourcePreview(memo)

            return (
              <div
                key={memo.id}
                className="group rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-primary/50"
                onClick={() => onMemoClick?.(memo)}
              >
                <div>
                  {memo.content ? (
                    <RichTextEditor
                      content={memo.content}
                      onChange={() => {}}
                      editable={false}
                      className="prose-sm prose-p:my-1 prose-headings:my-1 prose-ul:my-1 prose-ol:my-1"
                    />
                  ) : (
                    <span className="text-muted-foreground italic">无文字内容</span>
                  )}
                </div>
                
                {resourcePreviews.length > 0 && (
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    {resourcePreviews.map((preview, index) => {
                      const Icon = preview.icon
                      return (
                        <div
                          key={index}
                          className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground"
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span>{preview.count} {preview.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {memo.tags && memo.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {memo.tags.slice(0, 3).map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                    {memo.tags.length > 3 && (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        +{memo.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)

MemoList.displayName = 'MemoList'

