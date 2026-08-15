import { X } from "@phosphor-icons/react"
import { useState, type KeyboardEvent } from "react"
import { cn } from "../../lib/utils"

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function TagInput({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: TagInputProps) {
  const [input, setInput] = useState("")

  function addTag() {
    const tag = input.trim()
    if (tag && !value.includes(tag)) {
      onChange([...value, tag])
    }
    setInput("")
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      addTag()
    }
    if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex h-7 items-center gap-0.5 rounded-full bg-subtle pr-1 pl-2.5 text-xs font-medium text-ink"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== tag))}
                disabled={disabled}
                className="flex size-5 items-center justify-center rounded-full text-ink-tertiary transition-colors hover:bg-ink/10 hover:text-ink disabled:opacity-50"
                aria-label={`Remove ${tag}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="h-[40px] w-full rounded-md bg-subtle px-3 text-base text-ink transition-colors outline-none placeholder:text-ink-tertiary focus:bg-surface focus:ring-1 focus:ring-primary/50 focus:ring-inset md:h-9 md:text-sm"
      />
    </div>
  )
}
