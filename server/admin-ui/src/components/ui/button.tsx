import { forwardRef, type ButtonHTMLAttributes } from "react"
import { cn } from "../../lib/utils"

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "outline"
type Size = "default" | "sm" | "lg" | "icon" | "icon-sm"

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "bg-subtle text-ink hover:bg-subtle/70",
  ghost: "text-ink-secondary hover:bg-subtle hover:text-ink",
  destructive: "bg-error/10 text-error hover:bg-error/15",
  outline:
    "ring-1 ring-inset ring-hairline text-ink-secondary hover:bg-subtle hover:text-ink",
}

const sizes: Record<Size, string> = {
  default: "h-[44px] px-4 text-sm md:h-9",
  sm: "h-[44px] px-3 text-[13px] md:h-8",
  lg: "h-[48px] px-5 text-sm md:h-10",
  icon: "size-[44px] md:size-8",
  "icon-sm": "size-[44px] md:size-7",
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "default",
      type = "button",
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors duration-150 select-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
)

Button.displayName = "Button"
