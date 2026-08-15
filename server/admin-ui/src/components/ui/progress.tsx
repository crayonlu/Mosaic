import { Progress } from "@base-ui/react/progress"
import { cn } from "../../lib/utils"

interface ProgressBarProps {
  value: number
  className?: string
}

export function ProgressBar({ value, className }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <Progress.Root value={clamped} className={cn("block", className)}>
      <Progress.Track className="h-1.5 w-full overflow-hidden rounded-full bg-subtle">
        <Progress.Indicator
          className={cn(
            "h-full rounded-full bg-primary transition-[width] duration-300 ease-out",
            clamped >= 100 && "bg-success"
          )}
          style={{ width: `${clamped}%` }}
        />
      </Progress.Track>
    </Progress.Root>
  )
}
