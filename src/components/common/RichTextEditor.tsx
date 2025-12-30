import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Code } from '@tiptap/extension-code'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
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
import { marked } from 'marked'
import { useEffect, useState, useCallback } from 'react'
import { createLowlight } from 'lowlight'
import { cn } from '@/lib/utils'
import { Toolbar } from './RichTextEditor/Toolbar'
import { LinkDialog } from './RichTextEditor/LinkDialog'
import { useAI } from '@/hooks/use-ai'

import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import css from 'highlight.js/lib/languages/css'
import html from 'highlight.js/lib/languages/xml'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import bash from 'highlight.js/lib/languages/bash'
import markdown from 'highlight.js/lib/languages/markdown'
import yaml from 'highlight.js/lib/languages/yaml'
import xml from 'highlight.js/lib/languages/xml'

const lowlight = createLowlight()

lowlight.register('javascript', javascript)
lowlight.register('typescript', typescript)
lowlight.register('js', javascript)
lowlight.register('ts', typescript)
lowlight.register('css', css)
lowlight.register('html', html)
lowlight.register('json', json)
lowlight.register('python', python)
lowlight.register('py', python)
lowlight.register('java', java)
lowlight.register('cpp', cpp)
lowlight.register('c++', cpp)
lowlight.register('csharp', csharp)
lowlight.register('c#', csharp)
lowlight.register('go', go)
lowlight.register('rust', rust)
lowlight.register('rs', rust)
lowlight.register('sql', sql)
lowlight.register('bash', bash)
lowlight.register('sh', bash)
lowlight.register('shell', bash)
lowlight.register('markdown', markdown)
lowlight.register('md', markdown)
lowlight.register('yaml', yaml)
lowlight.register('yml', yaml)
lowlight.register('xml', xml)

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
  const [isCompleting, setIsCompleting] = useState(false)
  const { completeText, loading: aiLoading } = useAI()

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: false,
        code: false,
        link: false,
        underline: false,
      }),
      Code,
      CodeBlockLowlight.configure({
        lowlight,
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
        multicolor: true,
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
      handlePaste: (_view, event, _slice) => {
        const pastedText = event.clipboardData?.getData('text/plain') || ''

        const hasMarkdownSyntax =
          /(#+\s|^\s*[-*+]\s|\*\*.*\*\*|\*.*\*|`.*`|^\s*\d+\.\s|\[.*\]\(.*\)|^\s*>)/m.test(
            pastedText
          )

        if (hasMarkdownSyntax) {
          try {
            const htmlContent = marked.parse(pastedText)
            editor.commands.insertContent(htmlContent)
            return true
          } catch (error) {
            console.warn('Failed to parse pasted Markdown:', error)
          }
        }

        return false
      },
      handleKeyDown: (_view, event) => {
        if (editable && onSave && (event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault()
          onSave()
          return true
        }
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
          event.preventDefault()
          setIsLinkDialogOpen(true)
          return true
        }
        if ((event.ctrlKey || event.metaKey) && event.key === '\\') {
          event.preventDefault()
          editor.chain().focus().clearNodes().unsetAllMarks().run()
          return true
        }
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === '`') {
          event.preventDefault()
          editor.chain().focus().toggleCodeBlock().run()
          return true
        }
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === '.') {
          event.preventDefault()
          handleCompleteText()
          return true
        }
        return false
      },
    },
  })

  const handleCompleteText = useCallback(async () => {
    if (!editor || !editable || isCompleting || aiLoading) return

    const currentContent = editor.getText()
    if (!currentContent.trim()) return

    setIsCompleting(true)
    try {
      const result = await completeText({
        content: currentContent,
      })

      if (result?.generatedText) {
        const { to } = editor.state.selection
        editor.chain().focus().insertContentAt(to, result.generatedText).run()
      }
    } finally {
      setIsCompleting(false)
    }
  }, [editor, editable, isCompleting, aiLoading, completeText])

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
      {editable && editor && (
        <Toolbar
          editor={editor}
          onCompleteText={handleCompleteText}
          isCompleting={isCompleting || aiLoading}
        />
      )}
      <div
        className={cn(
          'flex-1 min-h-0 overflow-auto editor-scrollbar',
          isExpanded ? 'max-h-none' : 'max-h-[calc(100dvh-26rem)]'
        )}
      >
        <EditorContent editor={editor} />
      </div>
      {editable && editor && (
        <LinkDialog editor={editor} open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen} />
      )}
    </div>
  )
}
