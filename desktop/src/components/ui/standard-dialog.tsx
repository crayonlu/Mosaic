import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  type DialogProps,
} from './dialog'
import { cn } from '@/lib/utils'

type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | 'full'

const sizeClasses: Record<DialogSize, string> = {
  sm: 'max-w-[425px]',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  full: 'max-w-[95vw] max-h-[90vh]',
}

interface StandardDialogContentProps extends React.ComponentProps<typeof DialogContent> {
  size?: DialogSize
}

function StandardDialogContent({
  size = 'md',
  className,
  children,
  ...props
}: StandardDialogContentProps) {
  return (
    <DialogContent className={cn(sizeClasses[size], className)} {...props}>
      {children}
    </DialogContent>
  )
}

interface StandardDialogProps extends DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  size?: DialogSize
  children: React.ReactNode
  footer?: React.ReactNode
  showCloseButton?: boolean
}

export function StandardDialog({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  children,
  footer,
  showCloseButton = true,
  ...props
}: StandardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} {...props}>
      <StandardDialogContent size={size} showCloseButton={showCloseButton}>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </StandardDialogContent>
    </Dialog>
  )
}

export { StandardDialogContent, type DialogSize }
