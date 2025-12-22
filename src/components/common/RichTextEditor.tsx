import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Code } from '@tiptap/extension-code'
import { CodeBlock } from '@tiptap/extension-code-block'
import { Link } from '@tiptap/extension-link'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Underline } from '@tiptap/extension-underline'
import { Highlight } from '@tiptap/extension-highlight'
import { Markdown } from 'tiptap-markdown'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Toolbar } from './RichTextEditor/Toolbar'
import { LinkDialog } from './RichTextEditor/LinkDialog'

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
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Code,
      CodeBlock.configure({
        HTMLAttributes: {
          class: 'code-block',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Underline,
      Highlight.configure({
        multicolor: false,
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
        // Ctrl/Cmd + Enter 保存
        if (editable && onSave && (event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault()
          onSave()
          return true
        }
        // Ctrl/Cmd + K 插入链接
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
          event.preventDefault()
          setIsLinkDialogOpen(true)
          return true
        }
        // Ctrl/Cmd + \ 清除格式
        if ((event.ctrlKey || event.metaKey) && event.key === '\\') {
          event.preventDefault()
          editor.chain().focus().clearNodes().unsetAllMarks().run()
          return true
        }
        // Ctrl/Cmd + Shift + ` 代码块
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === '`') {
          event.preventDefault()
          editor.chain().focus().toggleCodeBlock().run()
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
      {editable && editor && <Toolbar editor={editor} />}
      <div className={cn(
        "flex-1 min-h-0 overflow-auto editor-scrollbar",
        isExpanded ? "max-h-none" : "max-h-[calc(100dvh-28rem)]"
      )}>
        <EditorContent editor={editor} />
      </div>
      {editable && editor && (
        <LinkDialog
          editor={editor}
          open={isLinkDialogOpen}
          onOpenChange={setIsLinkDialogOpen}
        />
      )}
    </div>
  )
}

