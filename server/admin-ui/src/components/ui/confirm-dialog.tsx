import { AlertDialog } from "@base-ui/react/alert-dialog"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "../../lib/utils"
import { Button } from "./button"

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: ReactNode
  description?: ReactNode
  confirmLabel?: ReactNode
  cancelLabel?: ReactNode
  danger?: boolean
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger,
  loading,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(o) => !o && !loading && onClose()}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="animate-fade-in fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px]" />
        <AlertDialog.Popup className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4 max-sm:items-end max-sm:p-0">
          <div
            className={cn(
              "pointer-events-auto w-full max-w-sm rounded-lg bg-surface p-5 shadow-modal",
              "animate-scale-in max-sm:animate-sheet-up max-sm:rounded-t-xl max-sm:rounded-b-none"
            )}
          >
            <AlertDialog.Title className="text-base font-semibold text-ink">
              {title}
            </AlertDialog.Title>
            {description && (
              <AlertDialog.Description className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
                {description}
              </AlertDialog.Description>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Close
                render={<Button variant="ghost" disabled={loading} />}
              >
                {cancelLabel ?? t("common.cancel")}
              </AlertDialog.Close>
              <Button
                variant={danger ? "destructive" : "primary"}
                disabled={loading}
                onClick={onConfirm}
              >
                {loading ? t("common.saving") : confirmLabel}
              </Button>
            </div>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
