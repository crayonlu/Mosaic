import { Menu } from "@base-ui/react/menu"
import type { ReactNode } from "react"
import { cn } from "../../lib/utils"

interface MenuItemDef {
  key: string
  label: ReactNode
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
  onSelect: () => void
}

interface AppMenuProps {
  trigger: ReactNode
  items: MenuItemDef[]
  align?: "start" | "center" | "end"
  className?: string
  ariaLabel?: string
}

export function AppMenu({
  trigger,
  items,
  align = "end",
  className,
  ariaLabel,
}: AppMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger
        render={<button type="button" aria-label={ariaLabel} />}
        className={cn("inline-flex", className)}
      >
        {trigger}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align={align} sideOffset={4} className="z-100">
          <Menu.Popup className="animate-pop-in min-w-36 rounded-lg bg-surface p-1 shadow-pop ring-1 ring-hairline">
            {items.map((item) => (
              <Menu.Item
                key={item.key}
                disabled={item.disabled}
                onClick={item.onSelect}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors outline-none",
                  "data-[highlighted]:bg-subtle",
                  item.danger ? "text-error" : "text-ink"
                )}
              >
                {item.icon}
                {item.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
