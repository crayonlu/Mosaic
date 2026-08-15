import type { ReactNode } from "react"

interface EmptyStateProps {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && (
        <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-subtle text-ink-tertiary">
          {icon}
        </div>
      )}
      <p className="text-[13px] font-medium text-ink">{title}</p>
      {description && (
        <p className="max-w-xs text-xs leading-relaxed text-ink-tertiary">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
