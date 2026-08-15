import { forwardRef, type LabelHTMLAttributes } from "react"
import { cn } from "../../lib/utils"

export const Label = forwardRef<
  HTMLLabelElement,
  LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn("block text-[13px] font-medium text-ink", className)}
    {...props}
  />
))

Label.displayName = "Label"
