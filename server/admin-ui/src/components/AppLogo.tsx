import { cn } from "../lib/utils"

export function AppLogo({ className }: { className?: string }) {
  return (
    <svg
      className={cn("text-primary", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <rect x={3} y={3} width={7} height={7} rx={1.5} />
      <rect x={14} y={3} width={7} height={7} rx={1.5} />
      <rect x={3} y={14} width={7} height={7} rx={1.5} />
      <rect x={14} y={14} width={7} height={7} rx={1.5} />
    </svg>
  )
}
