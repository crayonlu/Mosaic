import { forwardRef } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { LoadingSpinner } from './loading-spinner'
import { cn } from '@/lib/utils'
import { VariantProps } from 'class-variance-authority'

interface LoadingButtonProps
  extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  loadingText?: string
  spinnerSize?: 'sm' | 'md' | 'lg'
}

export const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    { loading = false, loadingText, spinnerSize = 'sm', children, disabled, className, ...props },
    ref
  ) => {
    return (
      <Button ref={ref} disabled={loading || disabled} className={cn(className)} {...props}>
        {loading ? (
          <>
            <LoadingSpinner size={spinnerSize} className="mr-2" />
            {loadingText || '加载中...'}
          </>
        ) : (
          children
        )}
      </Button>
    )
  }
)

LoadingButton.displayName = 'LoadingButton'
