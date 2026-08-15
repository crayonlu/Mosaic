import { CaretLeft, CaretRight } from "@phosphor-icons/react"
import { useTranslation } from "react-i18next"
import { cn } from "../../lib/utils"

interface PaginationProps {
  page: number
  totalPages: number
  total?: number
  onPageChange: (page: number) => void
  totalLabel?: string
  className?: string
}

export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
  totalLabel,
  className,
}: PaginationProps) {
  const { t } = useTranslation()
  if (totalPages <= 1) return null
  return (
    <div
      className={cn("flex items-center justify-between gap-4 pt-2", className)}
    >
      <span className="text-[13px] text-ink-tertiary">
        {totalLabel ??
          (total !== undefined ? t("users.total", { count: total }) : "")}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="flex size-[40px] items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-subtle hover:text-ink disabled:pointer-events-none disabled:opacity-40 md:size-8"
          aria-label={t("users.prevPage")}
        >
          <CaretLeft size={14} />
        </button>
        <span className="px-2 text-[13px] text-ink-secondary tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="flex size-[40px] items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-subtle hover:text-ink disabled:pointer-events-none disabled:opacity-40 md:size-8"
          aria-label={t("users.nextPage")}
        >
          <CaretRight size={14} />
        </button>
      </div>
    </div>
  )
}
