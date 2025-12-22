import { useState, useEffect } from 'react'
import { Editor } from '@tiptap/react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface LinkDialogProps {
  editor: Editor
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LinkDialog({ editor, open, onOpenChange }: LinkDialogProps) {
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')

  useEffect(() => {
    if (open) {
      const { from, to } = editor.state.selection
      const selectedText = editor.state.doc.textBetween(from, to, ' ')
      const linkAttrs = editor.getAttributes('link')
      
      setText(selectedText || linkAttrs.text || '')
      setUrl(linkAttrs.href || '')
    }
  }, [open, editor])

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
        editor
          .chain()
          .focus()
          .insertContent(`<a href="${url}">${text}</a>`)
          .run()
      } else {
        editor
          .chain()
          .focus()
          .insertContent(`<a href="${url}">${url}</a>`)
          .run()
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

  const isLinkActive = editor.isActive('link')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isLinkActive ? '编辑链接' : '插入链接'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="link-text" className="text-sm font-medium">
              链接文本
            </label>
            <Input
              id="link-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
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
              onChange={(e) => setUrl(e.target.value)}
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
            <Button type="submit" disabled={!url.trim()}>
              确定
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

