import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface LoadingSkeletonProps {
  className?: string
  lines?: number
  height?: string
}

export function LoadingSkeleton({ className, lines = 3, height = 'h-4' }: LoadingSkeletonProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn(height, i === lines - 1 ? 'w-3/4' : 'w-full')} />
      ))}
    </div>
  )
}

// Specific skeletons for different content types
export function LoadingCard() {
  return (
    <div className="p-4 border rounded-lg space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-20 w-full" />
    </div>
  )
}

export function LoadingList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center space-x-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Memo-specific skeleton components
export function LoadingMemoCard() {
  return (
    <div className="group rounded-lg border bg-card overflow-hidden text-sm text-card-foreground shadow-sm">
      <div className="p-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>

      <div className="p-4 border-t space-y-3">
        <div className="flex gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="w-8 h-8 rounded" />
          ))}
        </div>

        <div className="flex gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-12 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function LoadingMemoList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <LoadingMemoCard key={i} />
      ))}
    </div>
  )
}
