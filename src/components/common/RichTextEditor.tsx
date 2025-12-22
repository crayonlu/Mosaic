import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  className?: string
  editable?: boolean
  onSave?: () => void
  isExpanded?: boolean
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = '输入内容...',
  className,
  editable = true,
  onSave,
  isExpanded = false,
}: RichTextEditorProps) {
  const [, setRenderCounter] = useState(0)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Markdown,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm sm:prose lg:prose-lg xl:prose-xl',
          'max-w-none focus:outline-none',
          editable ? 'min-h-[120px] p-4' : 'p-4',
          className
        ),
      },
      handleKeyDown: (_view, event) => {
        if (editable && onSave && (event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault()
          onSave()
          return true
        }
        return false
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    const rerender = () => setRenderCounter(c => c + 1)
    editor.on('selectionUpdate', rerender)
    editor.on('transaction', rerender)
    return () => {
      editor.off('selectionUpdate', rerender)
      editor.off('transaction', rerender)
    }
  }, [editor])

  useEffect(() => {
    if (editor && editor.getHTML() !== content) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  if (!editor) {
    return null
  }

  return (
    <div className="w-full h-full border bg-background flex flex-col overflow-hidden">
      {editable && (
        <div className="flex items-center gap-1 border-b p-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            className={cn(
              'px-2 py-1 rounded text-sm transition-colors',
              editor.isActive('bold')
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            className={cn(
              'px-2 py-1 rounded text-sm transition-colors',
              editor.isActive('italic')
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            disabled={!editor.can().chain().focus().toggleStrike().run()}
            className={cn(
              'px-2 py-1 rounded text-sm transition-colors',
              editor.isActive('strike')
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
          >
            <s>S</s>
          </button>
          <div className="w-px h-6 bg-border mx-1" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={cn(
              'px-2 py-1 rounded text-sm transition-colors',
              editor.isActive('heading', { level: 1 })
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
          >
            H1
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={cn(
              'px-2 py-1 rounded text-sm transition-colors',
              editor.isActive('heading', { level: 2 })
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={cn(
              'px-2 py-1 rounded text-sm transition-colors',
              editor.isActive('heading', { level: 3 })
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
          >
            H3
          </button>
          <div className="w-px h-6 bg-border mx-1" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(
              'px-2 py-1 rounded text-sm transition-colors',
              editor.isActive('bulletList')
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
          >
            •
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(
              'px-2 py-1 rounded text-sm transition-colors',
              editor.isActive('orderedList')
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
          >
            1.
          </button>
          <div className="w-px h-6 bg-border mx-1" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={cn(
              'px-2 py-1 rounded text-sm transition-colors',
              editor.isActive('blockquote')
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
          >
            "
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="px-2 py-1 rounded text-sm transition-colors hover:bg-muted"
          >
            ─
          </button>
        </div>
      )}
      <div className={cn(
        "flex-1 min-h-0 overflow-auto editor-scrollbar",
        isExpanded ? "max-h-none" : "max-h-[calc(100dvh-28rem)]"
      )}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

