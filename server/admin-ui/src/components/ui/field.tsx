import type { ReactNode } from "react"
import { cn } from "../../lib/utils"

interface FieldProps {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label className="text-[13px] font-medium text-ink">
          {label}
          {required && <span className="ml-0.5 text-error">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-error">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-tertiary">{hint}</p>
      ) : null}
    </div>
  )
}
