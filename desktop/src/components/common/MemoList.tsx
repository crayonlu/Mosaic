import { ResourceThumbnails } from '@/components/common/ResourceThumbnails'
import { RichTextEditor } from '@/components/common/RichTextEditor'
import { LoadingSpinner } from '@/components/ui/loading/loading-spinner'
import type { MemoWithResources } from '@mosaic/api'
import { useMemoByDate, useMemos } from '@mosaic/api'
import { forwardRef, useImperativeHandle } from 'react'

interface MemoListProps {
  date?: string
  diaryDate?: string
  className?: string
  onMemoClick?: (memo: MemoWithResources) => void
}

export interface MemoListRef {
  refetch: () => Promise<void>
}

export const MemoList = forwardRef<MemoListRef, MemoListProps>(
  ({ date, diaryDate, className, onMemoClick }, ref) => {
    const diaryQuery = useMemos({ page: 1, pageSize: 100, archived: false, diaryDate })
    const dateQuery = useMemoByDate(date || '')
    const listQuery = useMemos({ page: 1, pageSize: 100, archived: false })

    const memos: MemoWithResources[] = diaryDate
      ? diaryQuery.data?.items || []
      : date
        ? dateQuery.data || []
        : listQuery.data?.items || []

    const loading = diaryDate
      ? diaryQuery.isLoading
      : date
        ? dateQuery.isLoading
        : listQuery.isLoading

    useImperativeHandle(
      ref,
      () => ({
        refetch: async () => {
          if (diaryDate) {
            await diaryQuery.refetch()
          } else if (date) {
            await dateQuery.refetch()
          } else {
            await listQuery.refetch()
          }
        },
      }),
      [date, diaryDate, diaryQuery, dateQuery, listQuery]
    )

    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" />
        </div>
      )
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
              className="group rounded-lg border bg-card overflow-hidden text-sm text-card-foreground transition-all cursor-pointer"
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
                  <></>
                )}
              </div>
              {(memo.resources.length > 0 || (memo.tags && memo.tags.length > 0)) && (
                <div className="p-2 border-t space-y-3">
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
