import { Tabs } from "@base-ui/react/tabs"
import type { ReactNode } from "react"
import { cn } from "../../lib/utils"

interface TabDef {
  value: string
  label: ReactNode
}

interface AppTabsProps {
  value: string
  onValueChange: (value: string) => void
  tabs: TabDef[]
  children?: ReactNode
  className?: string
}

export function AppTabs({
  value,
  onValueChange,
  tabs,
  children,
  className,
}: AppTabsProps) {
  return (
    <Tabs.Root
      value={value}
      onValueChange={onValueChange}
      className={cn("flex flex-col", className)}
    >
      <Tabs.List className="relative flex shrink-0 gap-1 border-b border-hairline">
        {tabs.map((tab) => (
          <Tabs.Tab
            key={tab.value}
            value={tab.value}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 px-3 py-2 text-[13px] font-medium transition-colors outline-none",
              "text-ink-tertiary hover:text-ink",
              "data-[selected]:text-ink"
            )}
          >
            {tab.label}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator
          className="absolute -bottom-px h-0.5 rounded-full bg-primary transition-[left,width] duration-200 ease-out"
          style={{
            left: "var(--active-tab-left)",
            width: "var(--active-tab-width)",
          }}
        />
      </Tabs.List>
      {children}
    </Tabs.Root>
  )
}

export function TabPanel({
  value,
  children,
  className,
  keepMounted,
}: {
  value: string
  children: ReactNode
  className?: string
  keepMounted?: boolean
}) {
  return (
    <Tabs.Panel
      value={value}
      keepMounted={keepMounted}
      className={cn("flex-1 pt-4 outline-none", className)}
    >
      {children}
    </Tabs.Panel>
  )
}
