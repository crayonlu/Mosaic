import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AILoadingIndicatorProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  inline?: boolean
}

export function AILoadingIndicator({
  className,
  size = 'md',
  inline = false,
}: AILoadingIndicatorProps) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  if (inline) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-muted-foreground', className)}>
        <Loader2 className={cn('animate-spin', sizeClasses[size])} />
        <span className="text-xs">AI处理中...</span>
      </span>
    )
  }

  return (
    <div className={cn('flex items-center justify-center gap-2 py-4', className)}>
      <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
      <span className="text-sm text-muted-foreground">AI处理中...</span>
    </div>
  )
}
