import { forwardRef, type TextareaHTMLAttributes } from "react"
import { cn } from "../../lib/utils"

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full resize-y rounded-md bg-subtle px-3 py-2.5 text-base leading-relaxed text-ink transition-colors duration-150 outline-none md:text-sm",
      "placeholder:text-ink-tertiary",
      "focus:bg-surface focus:ring-1 focus:ring-primary/50 focus:ring-inset",
      className
    )}
    {...props}
  />
))

Textarea.displayName = "Textarea"
