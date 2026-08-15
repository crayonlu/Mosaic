import type { HTMLAttributes } from "react"
import { cn } from "../../lib/utils"

type BadgeVariant =
  | "neutral"
  | "success"
  | "error"
  | "warning"
  | "info"
  | "outline"

const variants: Record<BadgeVariant, string> = {
  neutral: "bg-subtle text-ink-secondary",
  success: "bg-success/10 text-success",
  error: "bg-error/10 text-error",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
  outline: "ring-1 ring-inset ring-hairline text-ink-secondary",
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({
  className,
  variant = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}
