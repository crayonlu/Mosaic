import type { ReactNode } from "react"

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-[-0.01em] text-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 text-[13px] text-ink-secondary">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  )
}
