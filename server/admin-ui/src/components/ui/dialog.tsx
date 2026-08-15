import { Dialog } from "@base-ui/react/dialog"
import type { ReactNode } from "react"
import { X } from "@phosphor-icons/react"
import { cn } from "../../lib/utils"

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: "sm" | "md" | "lg"
  hideClose?: boolean
}

const sizes = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  hideClose,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="animate-fade-in fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px]" />
        <Dialog.Popup className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4 max-sm:items-end max-sm:p-0">
          <div
            className={cn(
              "pointer-events-auto flex max-h-[85vh] w-full flex-col overflow-hidden rounded-lg bg-surface shadow-modal",
              "animate-scale-in max-sm:animate-sheet-up max-sm:rounded-t-xl max-sm:rounded-b-none",
              sizes[size]
            )}
          >
            <div className="mx-auto mt-2 hidden h-1 w-10 shrink-0 rounded-full bg-ink-tertiary/30 max-sm:block" />
            {(title || !hideClose) && (
              <div className="flex items-start justify-between gap-4 px-5 pt-4">
                <div className="min-w-0">
                  {title && (
                    <Dialog.Title className="text-base font-semibold text-ink">
                      {title}
                    </Dialog.Title>
                  )}
                  {description && (
                    <Dialog.Description className="mt-1 text-[13px] text-ink-secondary">
                      {description}
                    </Dialog.Description>
                  )}
                </div>
                {!hideClose && (
                  <Dialog.Close
                    render={
                      <button
                        className="flex size-[40px] shrink-0 items-center justify-center rounded-md text-ink-tertiary transition-colors hover:bg-subtle hover:text-ink md:size-8"
                        aria-label="Close"
                      >
                        <X size={15} />
                      </button>
                    }
                  />
                )}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {children}
            </div>
            {footer && (
              <div className="flex justify-end gap-2 border-t border-hairline px-5 py-3.5">
                {footer}
              </div>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
