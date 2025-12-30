import { useState } from 'react'
import { Wand2, Loader2 } from 'lucide-react'
import { StandardDialog } from '@/components/ui/standard-dialog'
import { DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAI } from '@/hooks/use-ai'

interface AIRewriteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  originalText: string
  onReplace: (text: string) => void
  onInsert: (text: string) => void
}

const rewriteStyles = [
  { value: 'formal', label: '正式' },
  { value: 'concise', label: '简洁' },
  { value: 'detailed', label: '详细' },
  { value: 'creative', label: '创意' },
]

export function AIRewriteDialog({
  open,
  onOpenChange,
  originalText,
  onReplace,
  onInsert,
}: AIRewriteDialogProps) {
  const [style, setStyle] = useState('formal')
  const [rewrittenText, setRewrittenText] = useState('')
  const { rewriteText, loading } = useAI()

  const handleRewrite = async () => {
    if (!originalText.trim()) return

    const result = await rewriteText({
      text: originalText,
      style,
    })

    if (result) {
      setRewrittenText(result.rewrittenText)
    }
  }

  const handleReplace = () => {
    if (rewrittenText) {
      onReplace(rewrittenText)
      handleClose()
    }
  }

  const handleInsert = () => {
    if (rewrittenText) {
      onInsert(rewrittenText)
      handleClose()
    }
  }

  const handleClose = () => {
    setRewrittenText('')
    setStyle('formal')
    onOpenChange(false)
  }

  return (
    <StandardDialog open={open} onOpenChange={handleClose} size="2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          AI文本重写
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 ">
          <div className="space-y-2">
            <label className="text-sm font-medium">重写风格</label>
            <Select value={style} onValueChange={setStyle} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rewriteStyles.map(s => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!rewrittenText && (
            <div className="space-y-2">
              <label className="text-sm font-medium">原文</label>
              <Textarea
                value={originalText}
                readOnly
                rows={6}
                className="resize-none"
              />
            </div>
          )}

          {rewrittenText && (
            <div className="space-y-2">
              <label className="text-sm font-medium">重写结果</label>
              <Textarea
                value={rewrittenText}
                onChange={e => setRewrittenText(e.target.value)}
                rows={6}
                className="resize-none"
              />
            </div>
          )}

          {!rewrittenText && (
            <Button
              onClick={handleRewrite}
              disabled={loading || !originalText.trim()}
              className="w-full gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  重写中...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  开始重写
                </>
              )}
            </Button>
          )}
        </div>

      {rewrittenText && (
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button variant="outline" onClick={handleInsert}>
            插入
          </Button>
          <Button onClick={handleReplace}>替换</Button>
        </DialogFooter>
      )}
    </StandardDialog>
  )
}
