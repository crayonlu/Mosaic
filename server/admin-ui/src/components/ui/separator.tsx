import { Separator } from "@base-ui/react/separator"
import { cn } from "../../lib/utils"

export function Divider({
  className,
  orientation = "horizontal",
}: {
  className?: string
  orientation?: "horizontal" | "vertical"
}) {
  return (
    <Separator
      orientation={orientation}
      className={cn(
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        "bg-hairline",
        className
      )}
    />
  )
}
