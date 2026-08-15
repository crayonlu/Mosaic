import { cn } from "../../lib/utils"

interface SegmentedOption {
  value: string
  label: string
}

interface SegmentedControlProps {
  options: SegmentedOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps) {
  return (
    <div
      className={cn(
        "inline-flex gap-0.5 rounded-md bg-subtle p-0.5",
        className
      )}
      role="tablist"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "h-8 cursor-pointer rounded-[5px] px-3 text-[13px] font-medium transition-colors duration-150",
            "text-ink-secondary hover:text-ink",
            value === opt.value && "bg-surface text-ink shadow-sm"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
