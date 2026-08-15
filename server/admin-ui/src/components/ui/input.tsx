import { forwardRef, type InputHTMLAttributes } from "react"
import { cn } from "../../lib/utils"

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-[40px] w-full rounded-md bg-subtle px-3 text-base text-ink transition-colors duration-150 outline-none md:h-9 md:text-sm",
        "placeholder:text-ink-tertiary",
        "focus:bg-surface focus:ring-1 focus:ring-primary/50 focus:ring-inset",
        "disabled:pointer-events-none disabled:opacity-50",
        error && "ring-1 ring-error/60 ring-inset",
        className
      )}
      {...props}
    />
  )
)

Input.displayName = "Input"
