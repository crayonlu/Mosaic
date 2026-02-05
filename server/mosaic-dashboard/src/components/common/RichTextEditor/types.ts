import { Editor } from '@tiptap/react'
import type { LucideIcon } from 'lucide-react'

export interface ToolbarButtonProps {
  editor: Editor
  icon: LucideIcon
  label: string
  shortcut?: string
  onClick: () => void
  isActive?: () => boolean
  canExecute?: () => boolean
  className?: string
}

export interface ToolbarGroupProps {
  editor: Editor
  children: React.ReactNode
  className?: string
}
