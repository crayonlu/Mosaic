import { LoadingSpinner } from './loading-spinner'
import { cn } from '@/lib/utils'

interface LoadingOverlayProps {
  loading: boolean
  children: React.ReactNode
  message?: string
  className?: string
  spinnerSize?: 'sm' | 'md' | 'lg'
}

export function LoadingOverlay({
  loading,
  children,
  message = '加载中...',
  className,
  spinnerSize = 'md',
}: LoadingOverlayProps) {
  return (
    <div className={cn('relative', className)}>
      {children}
      {loading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-2">
            <LoadingSpinner size={spinnerSize} />
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
      )}
    </div>
  )
}
