import { Switch } from "@base-ui/react/switch"
import { cn } from "../../lib/utils"

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function AppSwitch({
  checked,
  onCheckedChange,
  disabled,
  className,
}: SwitchProps) {
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-[20px] w-[36px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150",
        "data-[checked]:bg-primary data-[unchecked]:bg-ink-tertiary/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <Switch.Thumb
        className={cn(
          "pointer-events-none block size-[16px] shrink-0 rounded-full bg-white shadow-sm transition-transform duration-150",
          "data-[checked]:translate-x-[18px] data-[unchecked]:translate-x-[2px]"
        )}
      />
    </Switch.Root>
  )
}
