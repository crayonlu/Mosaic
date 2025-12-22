import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { ToolbarButtonProps } from './types'

export function ToolbarButton({
  icon: Icon,
  label,
  shortcut,
  onClick,
  isActive,
  canExecute,
  className,
}: ToolbarButtonProps) {
  const active = isActive ? isActive() : false
  const canRun = canExecute ? canExecute() : true

  const tooltipContent = shortcut ? `${label} (${shortcut})` : label

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={!canRun}
          className={cn(
            'size-8 rounded-md text-sm transition-colors flex items-center justify-center',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            active
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted',
            className
          )}
          aria-label={label}
        >
          <Icon className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltipContent}</p>
      </TooltipContent>
    </Tooltip>
  )
}

