import { LoadingSkeleton, LoadingCard, LoadingList, LoadingMemoList } from './loading-skeleton'
import { LoadingOverlay } from './loading-overlay'

interface DataLoadingProps {
  loading: boolean
  type?: 'skeleton' | 'overlay' | 'card' | 'list' | 'memo-list'
  children: React.ReactNode
  message?: string
  skeletonLines?: number
  listCount?: number
}

export function DataLoading({
  loading,
  type = 'skeleton',
  children,
  message,
  skeletonLines,
  listCount,
}: DataLoadingProps) {
  if (!loading) return <>{children}</>

  switch (type) {
    case 'overlay':
      return (
        <LoadingOverlay loading={loading} message={message}>
          {children}
        </LoadingOverlay>
      )
    case 'card':
      return <LoadingCard />
    case 'list':
      return <LoadingList count={listCount} />
    case 'memo-list':
      return <LoadingMemoList count={listCount} />
    case 'skeleton':
    default:
      return <LoadingSkeleton lines={skeletonLines} />
  }
}
