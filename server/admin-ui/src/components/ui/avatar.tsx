import { User } from "@phosphor-icons/react"
import { cn } from "../../lib/utils"
import AuthImage from "../AuthImage"

interface AvatarProps {
  src?: string | null
  alt?: string
  initials?: string
  className?: string
}

export function Avatar({ src, alt = "", initials, className }: AvatarProps) {
  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-subtle text-xs font-medium text-ink-secondary",
        className
      )}
    >
      {src ? (
        <AuthImage src={src} alt={alt} className="size-full object-cover" />
      ) : initials ? (
        <span>{initials.slice(0, 2)}</span>
      ) : (
        <User size={14} />
      )}
    </div>
  )
}
