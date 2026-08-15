import { Spinner as PhosphorSpinner } from "@phosphor-icons/react"
import { cn } from "../../lib/utils"

export function LoadingSpinner({
  className,
  size = 16,
}: {
  className?: string
  size?: number
}) {
  return <PhosphorSpinner size={size} className={cn("spinner", className)} />
}
