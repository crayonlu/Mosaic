import { WarningCircle } from "@phosphor-icons/react"
import { useTranslation } from "react-i18next"
import { Button } from "./button"

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 px-6 py-12 text-center">
      <WarningCircle size={20} className="text-error" />
      <p className="max-w-sm text-[13px] break-words text-ink-secondary">
        {message ?? t("common.error")}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  )
}
