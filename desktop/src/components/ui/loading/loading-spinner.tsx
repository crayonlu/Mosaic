import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'max-h-4 max-w-4',
    md: 'max-h-5 max-w-5',
    lg: 'max-h-6 max-w-6',
  }

  return <Loader2 className={cn('animate-spin', sizeClasses[size], className)} />
}
