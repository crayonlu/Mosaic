import { AILoadingIndicator } from '@/components/common/AILoadingIndicator'
import { AuthImage } from '@/components/common/AuthImage'
import { Button } from '@/components/ui/button'
import { DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { StandardDialog } from '@/components/ui/standard-dialog'
import { Textarea } from '@/components/ui/textarea'
import { useAI } from '@/hooks/use-ai'
import { resolveApiUrl } from '@/lib/shared-api'
import { MOODS } from '@mosaic/utils'
import dayjs from 'dayjs'
import { Archive, Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'

interface ArchiveDialogProps {
  open: boolean
  onClose: () => void
  selectedCount: number
  date: string
  existingDiary?: {
    summary?: string
    moodKey?: string
    moodScore?: number
    coverImageId?: string
  }
  onConfirm: (
    summary?: string,
    moodKey?: string,
    moodScore?: number,
    coverImageId?: string
  ) => Promise<void>
  isLoading: boolean
  selectedMemosContent?: string
  selectedMemosResources?: Array<{ id: string; url: string }>
}

export function ArchiveDialog({
  open,
  onClose,
  selectedCount,
  date,
  existingDiary,
  onConfirm,
  isLoading,
  selectedMemosContent,
  selectedMemosResources = [],
}: ArchiveDialogProps) {
  const [summary, setSummary] = useState(existingDiary?.summary || '')
  const [moodKey, setMoodKey] = useState<string>(existingDiary?.moodKey || '')
  const [moodScore, setMoodScore] = useState<number[]>([existingDiary?.moodScore || 5])
  const [coverImageId, setCoverImageId] = useState<string | undefined>(existingDiary?.coverImageId)
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [isReplaceDialogOpen, setIsReplaceDialogOpen] = useState(false)
  const [pendingSummary, setPendingSummary] = useState<string>('')
  const { summarizeText, loading: aiLoading } = useAI()

  const handleConfirm = async () => {
    await onConfirm(summary.trim() || undefined, moodKey || undefined, moodScore[0], coverImageId)
  }

  const handleClose = () => {
    if (!isLoading) {
      setSummary('')
      setMoodKey('')
      setMoodScore([5])
      setCoverImageId(undefined)
      onClose()
    }
  }

  const handleGenerateSummary = async () => {
    if (!selectedMemosContent?.trim()) {
      return
    }

    setIsGeneratingSummary(true)
    try {
      const result = await summarizeText({
        text: selectedMemosContent,
      })

      if (result?.summary) {
        if (summary.trim()) {
          setPendingSummary(result.summary)
          setIsReplaceDialogOpen(true)
        } else {
          setSummary(result.summary)
        }
      }
    } finally {
      setIsGeneratingSummary(false)
    }
  }

  const handleConfirmReplace = () => {
    if (pendingSummary) {
      setSummary(pendingSummary)
      setPendingSummary('')
    }
    setIsReplaceDialogOpen(false)
  }

  const handleCancelReplace = () => {
    setPendingSummary('')
    setIsReplaceDialogOpen(false)
  }

  const handleSelectMood = (key: string) => {
    setMoodKey(key)
  }

  const dateDisplay = dayjs(date).format('M月D日 dddd')
  const isUpdate = !!existingDiary
  const allImages = selectedMemosResources.map(r => ({
    ...r,
    url: resolveApiUrl(r.url) || r.url,
  }))

  return (
    <StandardDialog open={open} onOpenChange={handleClose} size="full">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Archive className="h-5 w-5" />
          {isUpdate ? '更新日记' : '创建日记'} - {dateDisplay}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-6 py-4 px-2 overflow-y-auto max-h-[70vh]">
        <div className="text-sm text-muted-foreground">
          {isUpdate
            ? `将选中的 ${selectedCount} 条memo添加到 ${dateDisplay} 的日记中`
            : `将选中的 ${selectedCount} 条memo归档为 ${dateDisplay} 的日记`}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="summary">日记总结 (可选)</Label>
              {selectedMemosContent && selectedMemosContent.trim() && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerateSummary}
                  disabled={isLoading || isGeneratingSummary || aiLoading}
                  className="gap-2 h-7"
                >
                  {isGeneratingSummary || aiLoading ? (
                    <AILoadingIndicator size="sm" inline />
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      AI生成
                    </>
                  )}
                </Button>
              )}
            </div>
            <Textarea
              id="summary"
              placeholder="写下今天的心情或总结..."
              value={summary}
              onChange={e => setSummary(e.target.value)}
              rows={3}
              disabled={isLoading || isGeneratingSummary}
            />
          </div>

          <div className="space-y-3">
            <Label>心情</Label>
            <div className="flex flex-wrap gap-2">
              {MOODS.map(mood => (
                <button
                  key={mood.key}
                  type="button"
                  onClick={() => handleSelectMood(mood.key)}
                  disabled={isLoading}
                  className="flex flex-col items-center justify-center h-14 min-w-[4.5rem] rounded-lg border-2 transition-all hover:scale-105"
                  style={{
                    backgroundColor: mood.color,
                    borderColor: moodKey === mood.key ? '#000' : 'transparent',
                    opacity: moodKey === mood.key ? 1 : 0.8,
                  }}
                >
                  <span className="text-white text-xs font-semibold">{mood.label}</span>
                </button>
              ))}
            </div>

            {moodKey && (
              <div className="space-y-2 pt-2">
                <Label className="text-sm text-muted-foreground">心情强度: {moodScore[0]}/10</Label>
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

          {allImages.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>选择封面图片</Label>
                {coverImageId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCoverImageId(undefined)}
                    className="h-7 text-xs"
                  >
                    清除选择
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {allImages.map(resource => (
                  <div
                    key={resource.id}
                    className={`relative aspect-square overflow-hidden cursor-pointer transition-all ${
                      coverImageId === resource.id ? 'ring-2 ring-primary ring-offset-2' : ''
                    }`}
                    onClick={() => setCoverImageId(resource.id)}
                  >
                    <AuthImage
                      src={resource.url}
                      alt="cover"
                      className="w-full h-full object-cover"
                    />
                    {coverImageId === resource.id && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <div className="bg-primary text-white text-xs px-2 py-1 rounded">封面</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
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

      <StandardDialog
        open={isReplaceDialogOpen}
        onOpenChange={setIsReplaceDialogOpen}
        size="md"
        title="替换总结"
      >
        <div className="py-4">
          <p className="text-sm text-muted-foreground">已有总结内容，是否替换？</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancelReplace}>
            取消
          </Button>
          <Button onClick={handleConfirmReplace}>替换</Button>
        </DialogFooter>
      </StandardDialog>
    </StandardDialog>
  )
}
