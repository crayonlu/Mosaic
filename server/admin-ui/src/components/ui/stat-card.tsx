import type { ReactNode } from "react"
import { cn } from "../../lib/utils"

interface StatCardProps {
  label: ReactNode
  value: ReactNode
  icon?: ReactNode
  className?: string
}

export function StatCard({ label, value, icon, className }: StatCardProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {icon && (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-xl leading-tight font-semibold tracking-[-0.01em] text-ink tabular-nums">
          {value}
        </div>
        <div className="mt-0.5 text-xs font-medium text-ink-tertiary">
          {label}
        </div>
      </div>
    </div>
  )
}
