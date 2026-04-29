import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useToastStore } from '../hooks/useToast'

export default function ToastProvider() {
  const toasts = useToastStore((s) => s.toasts)

  const iconMap = {
    success: <CheckCircle size={16} />,
    error: <XCircle size={16} />,
    warning: <AlertTriangle size={16} />,
    info: <Info size={16} />,
  }

  const colorClasses = {
    success: 'border-l-success text-success',
    error: 'border-l-destructive text-destructive',
    warning: 'border-l-warning text-warning',
    info: 'border-l-info text-info',
  }

  return createPortal(
    <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 shadow-md border-l-[3px] text-sm leading-relaxed ${colorClasses[t.type]}`}
          style={{ animation: 'toast-in 250ms ease-out' }}
        >
          <span className="flex shrink-0">{iconMap[t.type]}</span>
          <span className="text-foreground">{t.message}</span>
        </div>
      ))}
    </div>,
    document.body
  )
}
