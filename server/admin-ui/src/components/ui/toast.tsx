import { Toast } from "@base-ui/react/toast"
import {
  CheckCircle,
  Info,
  WarningCircle,
  X,
  XCircle,
} from "@phosphor-icons/react"
import { useEffect, type ReactNode } from "react"
import { cn } from "../../lib/utils"
import { toastManagerRef, type ToastType } from "../../hooks/useToast"

const icons: Record<ToastType, ReactNode> = {
  success: <CheckCircle size={16} className="text-success" />,
  error: <XCircle size={16} className="text-error" />,
  warning: <WarningCircle size={16} className="text-warning" />,
  info: <Info size={16} className="text-info" />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider timeout={3500} limit={5}>
      {children}
      <ToastHost />
    </Toast.Provider>
  )
}

function ToastHost() {
  const manager = Toast.useToastManager()
  useEffect(() => {
    toastManagerRef.current = manager
    return () => {
      toastManagerRef.current = null
    }
  }, [manager])

  return (
    <Toast.Viewport className="fixed top-4 right-4 z-100 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {manager.toasts.map((toast) => {
        const type = (toast.type as ToastType) ?? "info"
        return (
          <Toast.Root
            key={toast.id}
            toast={toast}
            className={cn(
              "animate-toast-in flex items-start gap-2.5 rounded-lg bg-surface p-3 shadow-pop ring-1 ring-hairline",
              toast.transitionStatus === "ending" && "animate-toast-out"
            )}
          >
            <span className="mt-0.5 shrink-0">{icons[type]}</span>
            <Toast.Title className="min-w-0 flex-1 text-[13px] font-medium break-words text-ink">
              {toast.title}
            </Toast.Title>
            <Toast.Close
              render={
                <button
                  type="button"
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-ink-tertiary transition-colors hover:bg-subtle hover:text-ink"
                  aria-label="Close"
                >
                  <X size={13} />
                </button>
              }
            />
          </Toast.Root>
        )
      })}
    </Toast.Viewport>
  )
}
