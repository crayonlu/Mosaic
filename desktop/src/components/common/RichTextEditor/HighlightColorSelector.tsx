import { Editor } from '@tiptap/react'
import { useState, useRef, useEffect } from 'react'
import { Highlighter, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const highlightColors = [
  { value: 'rgba(255, 192, 120, 0.5)', label: '橙色' },
  { value: 'rgba(140, 233, 154, 0.5)', label: '绿色' },
  { value: 'rgba(116, 192, 252, 0.5)', label: '蓝色' },
  { value: 'rgba(177, 151, 252, 0.5)', label: '紫色' },
  { value: 'rgba(255, 168, 168, 0.5)', label: '红色' },
  { value: 'rgba(255, 212, 59, 0.5)', label: '黄色' },
  { value: 'rgba(165, 216, 255, 0.5)', label: '浅蓝' },
  { value: 'rgba(216, 245, 162, 0.5)', label: '浅绿' },
]

interface HighlightColorSelectorProps {
  editor: Editor
}

export function HighlightColorSelector({ editor }: HighlightColorSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentColor, setCurrentColor] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateColor = () => {
      const attrs = editor.getAttributes('highlight')
      setCurrentColor(editor.isActive('highlight') ? attrs.color || '' : '')
    }

    updateColor()
    editor.on('selectionUpdate', updateColor)
    editor.on('transaction', updateColor)

    return () => {
      editor.off('selectionUpdate', updateColor)
      editor.off('transaction', updateColor)
    }
  }, [editor])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleColorSelect = (color: string) => {
    if (color) {
      editor.chain().focus().toggleHighlight({ color }).run()
    } else {
      editor.chain().focus().unsetHighlight().run()
    }
    setIsOpen(false)
  }

  if (!editor.isActive('highlight')) {
    return null
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="h-8 gap-1 text-xs"
          >
            <div className="flex items-center gap-2">
              <Highlighter className="h-3 w-3" />
              <div
                className={cn(
                  'w-3 h-3 rounded border',
                  currentColor ? 'border-border' : 'border-muted-foreground/30'
                )}
                style={{ backgroundColor: currentColor || 'transparent' }}
              />
            </div>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>高亮颜色</p>
        </TooltipContent>
      </Tooltip>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-md p-2 min-w-[140px]">
          <div className="grid grid-cols-4 gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => handleColorSelect('')}
                  className={cn(
                    'w-6 h-6 rounded border-2 flex items-center justify-center hover:scale-110 transition-transform',
                    !currentColor ? 'border-primary' : 'border-transparent'
                  )}
                >
                  <Palette className="h-3 w-3 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>清除高亮</p>
              </TooltipContent>
            </Tooltip>
            {highlightColors.map(color => (
              <Tooltip key={color.value}>
                <TooltipTrigger asChild>
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => handleColorSelect(color.value)}
                    className={cn(
                      'w-6 h-6 rounded hover:scale-110 transition-transform border-2',
                      currentColor === color.value ? 'border-primary' : 'border-transparent'
                    )}
                    style={{ backgroundColor: color.value }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{color.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
