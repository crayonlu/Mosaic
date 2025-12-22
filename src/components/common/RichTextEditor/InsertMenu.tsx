import { Editor } from '@tiptap/react'
import { Table, Minus, MoreHorizontal } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface InsertMenuProps {
  editor: Editor
}

export function InsertMenu({ editor }: InsertMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const insertTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run()
    setIsOpen(false)
  }

  const insertHorizontalRule = () => {
    editor.chain().focus().setHorizontalRule().run()
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={menuRef}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              'size-8 rounded-md text-sm transition-colors flex items-center justify-center',
              isOpen ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            )}
            aria-label="插入"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>插入</p>
        </TooltipContent>
      </Tooltip>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 min-w-[120px]">
          <button
            type="button"
            onClick={insertTable}
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 rounded-t-md"
          >
            <Table className="size-4" />
            <span>表格</span>
          </button>
          <button
            type="button"
            onClick={insertHorizontalRule}
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 rounded-b-md"
          >
            <Minus className="size-4" />
            <span>分隔线</span>
          </button>
        </div>
      )}
    </div>
  )
}

