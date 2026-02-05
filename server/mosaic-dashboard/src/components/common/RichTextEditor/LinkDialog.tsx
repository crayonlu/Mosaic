import { useState, useEffect } from 'react'
import { Editor } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface LinkDialogProps {
  editor: Editor
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function LinkDialog({ editor, isOpen, onOpenChange }: LinkDialogProps) {
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')

  useEffect(() => {
    if (isOpen) {
      const { from, to } = editor.state.selection
      const selectedText = editor.state.doc.textBetween(from, to, ' ')
      const linkAttrs = editor.getAttributes('link')

      setText(selectedText || '')
      setUrl(linkAttrs.href || '')
    }
  }, [isOpen, editor])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!url.trim()) {
      onOpenChange(false)
      return
    }

    if (editor.isActive('link')) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    } else {
      const { from, to } = editor.state.selection
      const hasSelection = from !== to

      if (hasSelection) {
        editor.chain().focus().setLink({ href: url }).run()
      } else if (text.trim()) {
        editor.chain().focus().insertContent(`<a href="${url}">${text}</a>`).run()
      } else {
        editor.chain().focus().insertContent(`<a href="${url}">${url}</a>`).run()
      }
    }

    onOpenChange(false)
    setUrl('')
    setText('')
  }

  const handleRemove = () => {
    editor.chain().focus().unsetLink().run()
    onOpenChange(false)
    setUrl('')
    setText('')
  }

  if (!isOpen) return null

  const isLinkActive = editor.isActive('link')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold mb-4">{isLinkActive ? '编辑链接' : '插入链接'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="link-text" className="text-sm font-medium">
              链接文本
            </label>
            <Input
              id="link-text"
              value={text}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value)}
              placeholder="链接显示的文本"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="link-url" className="text-sm font-medium">
              链接地址
            </label>
            <Input
              id="link-url"
              type="url"
              value={url}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
              placeholder="https://example.com"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            {isLinkActive && (
              <Button type="button" variant="destructive" onClick={handleRemove}>
                移除链接
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit">确认</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
