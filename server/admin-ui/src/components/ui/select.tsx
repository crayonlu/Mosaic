import { Select } from "@base-ui/react/select"
import { CaretDown, Check } from "@phosphor-icons/react"
import { cn } from "../../lib/utils"

interface SelectOption {
  value: string
  label: string
}

interface AppSelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function AppSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
}: AppSelectProps) {
  return (
    <Select.Root
      items={options}
      value={value}
      onValueChange={(v) => onChange(v ?? "")}
      disabled={disabled}
    >
      <Select.Trigger
        render={
          <button
            type="button"
            className={cn(
              "h-[40px] w-full rounded-md bg-subtle px-3 text-left text-base text-ink transition-colors outline-none md:h-9 md:text-sm",
              "data-[disabled]:opacity-50",
              "focus:bg-surface",
              className
            )}
          />
        }
      >
        <span className="flex flex-1 items-center justify-between gap-2">
          <Select.Value
            className="truncate text-ink"
            placeholder={placeholder ?? ""}
          />
          <CaretDown size={13} className="shrink-0 text-ink-tertiary" />
        </span>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          align="start"
          sideOffset={4}
          className="z-100 w-[var(--anchor-width)]"
        >
          <Select.Popup className="animate-pop-in max-h-64 overflow-y-auto rounded-lg bg-surface p-1 shadow-pop ring-1 ring-hairline">
            {options.map((opt) => (
              <Select.Item
                key={opt.value}
                value={opt.value}
                className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 text-[13px] text-ink outline-none data-[highlighted]:bg-subtle"
              >
                <Select.ItemText className="truncate">
                  {opt.label}
                </Select.ItemText>
                <Select.ItemIndicator className="shrink-0 text-primary">
                  <Check size={14} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}
