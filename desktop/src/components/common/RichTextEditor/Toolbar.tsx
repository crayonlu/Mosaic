import { cn } from '@/lib/utils'
import { Editor } from '@tiptap/react'
import {
  Bold,
  CheckSquare,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Sparkles,
  Strikethrough,
  Underline,
  Undo2,
  Wand2,
} from 'lucide-react'
import { useState } from 'react'
import { AIRewriteDialog } from '../AIRewriteDialog'
import { CodeBlockLanguageSelector } from './CodeBlockLanguageSelector'
import { HighlightColorSelector } from './HighlightColorSelector'
import { InsertMenu } from './InsertMenu'
import { LinkDialog } from './LinkDialog'
import { ToolbarButton } from './ToolbarButton'

interface ToolbarProps {
  editor: Editor
  className?: string
  onCompleteText?: () => void
  isCompleting?: boolean
}

export function Toolbar({ editor, className, onCompleteText, isCompleting }: ToolbarProps) {
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false)
  const [isRewriteDialogOpen, setIsRewriteDialogOpen] = useState(false)

  if (!editor || !editor.view || editor.isDestroyed) {
    return null
  }

  const formatButtons = [
    {
      icon: Bold,
      label: '粗体',
      shortcut: 'Ctrl+B',
      onClick: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive('bold'),
      canExecute: () => editor?.can()?.chain()?.focus()?.toggleBold()?.run() ?? false,
    },
    {
      icon: Italic,
      label: '斜体',
      shortcut: 'Ctrl+I',
      onClick: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive('italic'),
      canExecute: () => editor?.can()?.chain()?.focus()?.toggleItalic()?.run() ?? false,
    },
    {
      icon: Strikethrough,
      label: '删除线',
      shortcut: 'Ctrl+Shift+X',
      onClick: () => editor.chain().focus().toggleStrike().run(),
      isActive: () => editor.isActive('strike'),
      canExecute: () => editor?.can()?.chain()?.focus()?.toggleStrike()?.run() ?? false,
    },
    {
      icon: Underline,
      label: '下划线',
      shortcut: 'Ctrl+U',
      onClick: () => editor.chain().focus().toggleUnderline().run(),
      isActive: () => editor.isActive('underline'),
      canExecute: () => editor?.can()?.chain()?.focus()?.toggleUnderline()?.run() ?? false,
    },
    {
      icon: Code,
      label: '行内代码',
      shortcut: 'Ctrl+`',
      onClick: () => editor.chain().focus().toggleCode().run(),
      isActive: () => editor.isActive('code'),
      canExecute: () => editor?.can()?.chain()?.focus()?.toggleCode()?.run() ?? false,
    },
    {
      icon: Highlighter,
      label: '高亮',
      shortcut: 'Ctrl+Shift+H',
      onClick: () => editor.chain().focus().toggleHighlight().run(),
      isActive: () => editor.isActive('highlight'),
      canExecute: () => editor?.can()?.chain()?.focus()?.toggleHighlight()?.run() ?? false,
    },
  ]

  // 结构组
  const structureButtons = [
    {
      icon: Heading1,
      label: '标题 1',
      shortcut: 'Ctrl+Alt+1',
      onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: () => editor.isActive('heading', { level: 1 }),
    },
    {
      icon: Heading2,
      label: '标题 2',
      shortcut: 'Ctrl+Alt+2',
      onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: () => editor.isActive('heading', { level: 2 }),
    },
    {
      icon: Heading3,
      label: '标题 3',
      shortcut: 'Ctrl+Alt+3',
      onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: () => editor.isActive('heading', { level: 3 }),
    },
    {
      icon: List,
      label: '无序列表',
      shortcut: 'Ctrl+Shift+8',
      onClick: () => editor.chain().focus().toggleBulletList().run(),
      isActive: () => editor.isActive('bulletList'),
    },
    {
      icon: ListOrdered,
      label: '有序列表',
      shortcut: 'Ctrl+Shift+7',
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: () => editor.isActive('orderedList'),
    },
    {
      icon: CheckSquare,
      label: '任务列表',
      shortcut: 'Ctrl+Shift+9',
      onClick: () => editor.chain().focus().toggleTaskList().run(),
      isActive: () => editor.isActive('taskList'),
    },
    {
      icon: Quote,
      label: '引用',
      shortcut: 'Ctrl+Shift+>',
      onClick: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: () => editor.isActive('blockquote'),
    },
  ]

  // 插入组
  const insertButtons = [
    {
      icon: Link,
      label: '链接',
      shortcut: 'Ctrl+K',
      onClick: () => setIsLinkDialogOpen(true),
      isActive: () => editor.isActive('link'),
    },
    {
      icon: Code2,
      label: '代码块',
      shortcut: 'Ctrl+Shift+`',
      onClick: () => editor.chain().focus().toggleCodeBlock().run(),
      isActive: () => editor.isActive('codeBlock'),
    },
  ]

  const getSelectedText = () => {
    const { from, to } = editor.state.selection
    if (from !== to) {
      return editor.state.doc.textBetween(from, to)
    }
    return editor.getText()
  }

  const handleReplace = (text: string) => {
    const { from, to } = editor.state.selection
    if (from !== to) {
      editor.chain().focus().deleteSelection().insertContent(text).run()
    } else {
      editor.chain().focus().setContent(text).run()
    }
  }

  const handleInsert = (text: string) => {
    editor.chain().focus().insertContent(text).run()
  }

  const handleRewriteClick = () => {
    const selectedText = getSelectedText()
    if (selectedText.trim()) {
      setIsRewriteDialogOpen(true)
    }
  }

  const aiButtons = [
    {
      icon: Sparkles,
      label: 'AI补全',
      shortcut: 'Ctrl+Shift+.',
      onClick: () => {
        if (onCompleteText && editor.getText().trim() && !isCompleting) {
          onCompleteText()
        }
      },
      canExecute: () => !!onCompleteText && !!editor.getText().trim() && !isCompleting,
    },
    {
      icon: Wand2,
      label: 'AI重写',
      shortcut: 'Ctrl+Shift+R',
      onClick: handleRewriteClick,
    },
  ]

  const otherButtons = [
    {
      icon: RemoveFormatting,
      label: '清除格式',
      shortcut: 'Ctrl+\\',
      onClick: () => editor.chain().focus().clearNodes().unsetAllMarks().run(),
    },
    {
      icon: Undo2,
      label: '撤销',
      shortcut: 'Ctrl+Z',
      onClick: () => editor.chain().focus().undo().run(),
      canExecute: () => editor?.can()?.chain()?.focus()?.undo()?.run() ?? false,
    },
    {
      icon: Redo2,
      label: '重做',
      shortcut: 'Ctrl+Y',
      onClick: () => editor.chain().focus().redo().run(),
      canExecute: () => editor?.can()?.chain()?.focus()?.redo()?.run() ?? false,
    },
  ]

  return (
    <div className={cn('flex items-center gap-1 border-b p-2 flex-wrap shrink-0 border', className)}>
      <div className="flex items-center gap-1">
        {formatButtons.map(btn => (
          <ToolbarButton key={btn.label} editor={editor} {...btn} />
        ))}
      </div>

      <div className="w-px h-6 bg-border mx-1" />

      <div className="flex items-center gap-1">
        {structureButtons.map(btn => (
          <ToolbarButton key={btn.label} editor={editor} {...btn} />
        ))}
      </div>

      <div className="w-px h-6 bg-border mx-1" />

      <div className="flex items-center gap-1">
        {insertButtons.map(btn => (
          <ToolbarButton key={btn.label} editor={editor} {...btn} />
        ))}
        <InsertMenu editor={editor} />
        <CodeBlockLanguageSelector editor={editor} />
        <HighlightColorSelector editor={editor} />
      </div>

      <div className="w-px h-6 bg-border mx-1" />

      <div className="flex items-center gap-1">
        {aiButtons.map(btn => (
          <ToolbarButton key={btn.label} editor={editor} {...btn} />
        ))}
      </div>

      <div className="w-px h-6 bg-border mx-1" />

      <div className="flex items-center gap-1">
        {otherButtons.map(btn => (
          <ToolbarButton key={btn.label} editor={editor} {...btn} />
        ))}
      </div>

      <LinkDialog editor={editor} open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen} />
      <AIRewriteDialog
        open={isRewriteDialogOpen}
        onOpenChange={setIsRewriteDialogOpen}
        originalText={getSelectedText()}
        onReplace={handleReplace}
        onInsert={handleInsert}
      />
    </div>
  )
}
