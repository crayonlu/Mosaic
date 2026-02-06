import { cn } from '@/lib/utils'
import { Code } from '@tiptap/extension-code'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { Highlight } from '@tiptap/extension-highlight'
import { Link } from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'
import { TaskItem } from '@tiptap/extension-task-item'
import { TaskList } from '@tiptap/extension-task-list'
import { Underline } from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { createLowlight } from 'lowlight'
import { marked } from 'marked'
import { useCallback, useEffect, useState } from 'react'
import { Markdown } from 'tiptap-markdown'
import { LinkDialog } from './RichTextEditor/LinkDialog'
import { Toolbar } from './RichTextEditor/Toolbar'

import bash from 'highlight.js/lib/languages/bash'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import { default as html, default as xml } from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

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
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = '输入内容...',
  className,
  editable = true,
  onSave,
}: RichTextEditorProps) {
  const [, setRenderCounter] = useState(0)
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false)
  const [markdownMode, setMarkdownMode] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: false,
        code: false,
      }),
      Code.configure({
        HTMLAttributes: {
          class: 'rounded bg-stone-100 dark:bg-stone-800 px-1 py-0.5 font-mono text-sm',
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'javascript',
        HTMLAttributes: {
          class: 'rounded-lg border border-stone-200 dark:border-stone-800',
        },
      }),
      Highlight.configure({
        HTMLAttributes: {
          class: 'rounded px-0.5 py-0.5 font-medium text-stone-900 dark:text-stone-100',
        },
      }),
      Link.configure({
        HTMLAttributes: {
          class:
            'text-stone-600 dark:text-stone-400 underline decoration-stone-300 dark:decoration-stone-700',
        },
      }),
      Table.configure({
        HTMLAttributes: {
          class: 'min-w-full divide-y divide-stone-200 dark:divide-stone-700',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'px-3 py-2 text-sm text-stone-700 dark:text-stone-300',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class:
            'bg-stone-50 dark:bg-stone-800 px-3 py-2 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider',
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: 'bg-white dark:bg-stone-900',
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'list-none pl-4',
        },
      }),
      TaskItem.configure({
        HTMLAttributes: {
          class: 'flex items-start gap-2',
        },
      }),
      Underline.configure({
        HTMLAttributes: {
          class: 'underline decoration-stone-400',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Markdown.configure({
        html: true,
        transformCopiedText: true,
      }),
    ],
    content,
    editable,
    onUpdate: () => {
      if (editor) {
        onChange(editor.getHTML())
        setRenderCounter(c => c + 1)
      }
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false)
    }
  }, [content, editor])

  const handleSave = useCallback(() => {
    onSave?.()
  }, [onSave])

  if (!editor) {
    return null
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-stone-200 dark:border-stone-800 flex flex-col',
        className
      )}
    >
      <Toolbar
        editor={editor}
        onToggleMarkdown={() => setMarkdownMode(!markdownMode)}
        markdownMode={markdownMode}
        onSave={handleSave}
      />
      <div className="relative flex-1 flex">
        <EditorContent
          editor={editor}
          className="prose dark:prose-invert max-w-none h-50 w-full [&>.ProseMirror]:h-full [&>.ProseMirror]:outline-none [&>.ProseMirror]:p-2"
        />
        {markdownMode && (
          <div className="absolute inset-0 overflow-auto p-4 font-mono text-sm text-stone-800 dark:text-stone-200">
            {marked.parse(editor.getHTML()) as string}
          </div>
        )}
      </div>
      <LinkDialog isOpen={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen} editor={editor} />
    </div>
  )
}
