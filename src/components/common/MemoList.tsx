import { memoCommands } from '@/utils/callRust'
import type { MemoWithResources } from '@/types/memo'
import { useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react'
import { RichTextEditor } from '@/components/common/RichTextEditor'
import { ResourceThumbnails } from '@/components/common/ResourceThumbnails'
import { LoadingMemoList } from '@/components/ui/loading/loading-skeleton'

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

    useImperativeHandle(
      ref,
      () => ({
        refetch: fetchMemos,
      }),
      [fetchMemos]
    )

    useEffect(() => {
      fetchMemos()
    }, [fetchMemos])

    if (loading) {
      return <LoadingMemoList count={3} />
    }

    if (memos.length === 0) {
      return null
    }

    return (
      <div className={className}>
        <div className="space-y-2">
          {memos.map(memo => (
            <div
              key={memo.id}
              className="group rounded-lg border bg-card overflow-hidden text-sm text-card-foreground shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-primary/50"
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
                  <div className="text-muted-foreground italic p-4">无文字内容</div>
                )}
              </div>
              {(memo.resources.length > 0 || (memo.tags && memo.tags.length > 0)) && (
                <div className="p-4 border-t space-y-3">
                  {memo.resources.length > 0 && <ResourceThumbnails resources={memo.resources} />}

                  {memo.tags && memo.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
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
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }
)

MemoList.displayName = 'MemoList'
