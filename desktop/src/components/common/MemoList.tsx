import { MemoCard } from '@/components/common/MemoCard'
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
            <MemoCard key={memo.id} memo={memo} onClick={() => onMemoClick?.(memo)} />
          ))}
        </div>
      </div>
    )
  }
)

MemoList.displayName = 'MemoList'
