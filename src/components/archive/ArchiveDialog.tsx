import { useState } from 'react'
import dayjs from 'dayjs'
import { Archive, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { MOOD_OPTIONS } from '@/utils/moodEmoji'

interface ArchiveDialogProps {
  open: boolean
  onClose: () => void
  selectedCount: number
  date: string
  existingDiary?: {
    summary?: string
    moodKey?: string
    moodScore?: number
  }
  onConfirm: (summary?: string, moodKey?: string, moodScore?: number) => Promise<void>
  isLoading: boolean
}

export function ArchiveDialog({
  open,
  onClose,
  selectedCount,
  date,
  existingDiary,
  onConfirm,
  isLoading,
}: ArchiveDialogProps) {
  const [summary, setSummary] = useState(existingDiary?.summary || '')
  const [moodKey, setMoodKey] = useState<string>(existingDiary?.moodKey || '')
  const [moodScore, setMoodScore] = useState<number[]>([existingDiary?.moodScore || 5])

  const handleConfirm = async () => {
    await onConfirm(summary.trim() || undefined, moodKey || undefined, moodScore[0])
  }

  const handleClose = () => {
    if (!isLoading) {
      setSummary('')
      setMoodKey('')
      setMoodScore([5])
      onClose()
    }
  }

  const dateDisplay = dayjs(date).format('M月D日 dddd')
  const isUpdate = !!existingDiary

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            {isUpdate ? '更新日记' : '创建日记'} - {dateDisplay}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="text-sm text-muted-foreground">
            {isUpdate
              ? `将选中的 ${selectedCount} 条memo添加到 ${dateDisplay} 的日记中`
              : `将选中的 ${selectedCount} 条memo归档为 ${dateDisplay} 的日记`}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="summary">日记总结 (可选)</Label>
              <Textarea
                id="summary"
                placeholder="写下今天的心情或总结..."
                value={summary}
                onChange={e => setSummary(e.target.value)}
                rows={3}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-3">
              <Label>心情</Label>
              <Select value={moodKey} onValueChange={setMoodKey} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="选择今天的心情" />
                </SelectTrigger>
                <SelectContent>
                  {MOOD_OPTIONS.map(mood => (
                    <SelectItem key={mood.key} value={mood.key}>
                      <div className="flex items-center gap-2">
                        <span>{mood.emoji}</span>
                        <span>{mood.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {moodKey && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    心情强度: {moodScore[0]}/10
                  </Label>
                  <Slider
                    value={moodScore}
                    onValueChange={setMoodScore}
                    max={10}
                    min={1}
                    step={1}
                    className="w-full"
                    disabled={isLoading}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading} className="gap-2">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? '归档中...' : '确认归档'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
