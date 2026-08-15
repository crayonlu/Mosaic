import { Tooltip } from "@base-ui/react/tooltip"
import type { ReactNode } from "react"
import { cn } from "../../lib/utils"

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <Tooltip.Provider>{children}</Tooltip.Provider>
}

interface AppTooltipProps {
  content: ReactNode
  children: ReactNode
  className?: string
  side?: "top" | "bottom" | "left" | "right"
}

export function AppTooltip({
  content,
  children,
  className,
  side = "top",
}: AppTooltipProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={<span className="inline-flex" />}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner side={side} sideOffset={6} className="z-100">
          <Tooltip.Popup
            className={cn(
              "animate-pop-in rounded-md bg-ink px-2 py-1 text-xs font-medium text-canvas shadow-pop",
              className
            )}
          >
            {content}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
