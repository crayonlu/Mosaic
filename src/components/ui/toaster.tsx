import { Toaster as Sonner } from 'sonner'
import { useTheme } from '@/hooks/use-theme'

export function Toaster() {
  const { theme } = useTheme()

  return (
    <Sonner
      position="top-right"
      richColors
      closeButton
      theme={theme}
      toastOptions={{
        classNames: {
          success: 'toast-success',
          error: 'toast-error',
          warning: 'toast-warning',
          info: 'toast-info',
        },
      }}
    />
  )
}
