import { Editor } from '@tiptap/react'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const languages = [
  { value: '', label: '纯文本' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'xml', label: 'XML' },
  { value: 'markdown', label: 'Markdown' },
]

interface CodeBlockLanguageSelectorProps {
  editor: Editor
}

export function CodeBlockLanguageSelector({ editor }: CodeBlockLanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentLanguage, setCurrentLanguage] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateLanguage = () => {
      if (editor.isActive('codeBlock')) {
        const attrs = editor.getAttributes('codeBlock')
        const lang = attrs.language || ''
        setCurrentLanguage(lang)
      } else {
        setCurrentLanguage('')
      }
    }

    updateLanguage()
    editor.on('selectionUpdate', updateLanguage)
    editor.on('transaction', updateLanguage)

    return () => {
      editor.off('selectionUpdate', updateLanguage)
      editor.off('transaction', updateLanguage)
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
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleLanguageSelect = (language: string) => {
    if (editor.isActive('codeBlock')) {
      if (language) {
        editor.chain().focus().updateAttributes('codeBlock', { language }).run()
      } else {
        editor.chain().focus().updateAttributes('codeBlock', { language: null }).run()
      }
    }
    setIsOpen(false)
  }

  if (!editor.isActive('codeBlock')) {
    return null
  }

  const currentLabel = languages.find(lang => lang.value === currentLanguage)?.label || '纯文本'

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 gap-1 text-xs"
      >
        <span>{currentLabel}</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
      </Button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-md shadow-lg max-h-64 overflow-y-auto min-w-[120px]">
          {languages.map((lang) => (
            <button
              key={lang.value}
              type="button"
              onClick={() => handleLanguageSelect(lang.value)}
              className={cn(
                'w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors',
                currentLanguage === lang.value && 'bg-accent text-accent-foreground'
              )}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

