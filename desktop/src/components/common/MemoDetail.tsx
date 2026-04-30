import { BotReplyList } from '@/components/bot/BotReplyList'
import { BotThreadPanel } from '@/components/bot/BotThreadPanel'
import { MarkdownPreview } from '@/components/common/MarkdownPreview'
import { MemoImageGrid } from '@/components/common/MemoImageGrid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useAI } from '@/hooks/useAI'
import { uploadFiles } from '@/hooks/useFileUpload'
import { toast } from '@/hooks/useToast'
import { resolveApiUrl } from '@/lib/sharedApi'
import { cn } from '@/lib/utils'
import { normalizeContent } from '@/utils/content'
import type { BotReply, Memo, Resource } from '@mosaic/api'
import {
  resourcesApi,
  useBotReplies,
  useDeleteMemo,
  useTriggerReplies,
  useUpdateMemo,
} from '@mosaic/api'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import {
  ArrowLeft,
  Calendar,
  Edit2,
  Image as ImageIcon,
  Loader2,
  Save,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

dayjs.extend(utc)

interface MemoDetailProps {
  memo: Memo | null
  open: boolean
  onClose: () => void
  onUpdate?: () => void
  onDelete?: () => void
  onMemoNavigate?: (memoId: string) => void
}

export function MemoDetail({
  memo,
  open,
  onClose,
  onUpdate,
  onDelete,
  onMemoNavigate,
}: MemoDetailProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const [editedTags, setEditedTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [editedAISummary, setEditedAISummary] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [isReplaceSummaryDialogOpen, setIsReplaceSummaryDialogOpen] = useState(false)
  const [pendingSummary, setPendingSummary] = useState('')
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleteResourceDialogOpen, setIsDeleteResourceDialogOpen] = useState(false)
  const [resourceToDelete, setResourceToDelete] = useState<string | null>(null)
  const [editingResources, setEditingResources] = useState<Resource[]>([])
  const [hasResourceChanges, setHasResourceChanges] = useState(false)
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map())
  const [videoUrls, setVideoUrls] = useState<Map<string, string>>(new Map())
  const [thumbnailUrls, setThumbnailUrls] = useState<Map<string, string>>(new Map())
  const [targetReply, setTargetReply] = useState<BotReply | null>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const { suggestTags, summarizeText, loading: aiLoading } = useAI()
  const updateMemo = useUpdateMemo()
  const deleteMemo = useDeleteMemo()
  const { refetch: refetchReplies } = useBotReplies(memo?.id ?? '')
  const { mutateAsync: triggerReplies } = useTriggerReplies()

  const displayResources = useMemo(
    () => (isEditing ? editingResources : memo?.resources || []),
    [isEditing, editingResources, memo?.resources]
  )
  const imageResources = displayResources.filter(r => r.resourceType === 'image')
  const videoResources = displayResources.filter(r => r.resourceType === 'video')

  useEffect(() => {
    if (!memo) {
      setIsEditing(false)
      setEditedContent('')
      setEditedAISummary('')
      return
    }

    if (!isEditing) {
      setEditedContent(memo.content)
      setEditedAISummary(memo.aiSummary || '')
      setEditingResources(memo.resources ?? [])
      setHasResourceChanges(false)
    }

    const loadResources = async () => {
      const newImageUrls = new Map<string, string>()
      const newVideoUrls = new Map<string, string>()
      const newThumbnailUrls = new Map<string, string>()

      for (const resource of displayResources) {
        const url = resolveApiUrl(resource.url)
        if (!url) continue

        if (resource.resourceType === 'image') {
          newImageUrls.set(resource.id, url)
        } else if (resource.resourceType === 'video') {
          newVideoUrls.set(resource.id, url)
        }

        if (resource.thumbnailUrl) {
          const thumbnailUrl = resolveApiUrl(resource.thumbnailUrl)
          if (thumbnailUrl) {
            newThumbnailUrls.set(resource.id, thumbnailUrl)
          }
        }
      }

      setImageUrls(newImageUrls)
      setVideoUrls(newVideoUrls)
      setThumbnailUrls(newThumbnailUrls)
    }

    loadResources()

    return () => {
      setImageUrls(new Map())
      setVideoUrls(new Map())
      setThumbnailUrls(new Map())
    }
  }, [memo, isEditing, displayResources])

  const handleStartEdit = () => {
    if (memo) {
      setEditedContent(memo.content)
      setEditedTags([...memo.tags])
      setEditedAISummary(memo.aiSummary || '')
      setTagInput('')
      setEditingResources(memo.resources ?? [])
      setHasResourceChanges(false)
      setIsEditing(true)
    }
  }

  const handleCancelEdit = () => {
    if (memo) {
      setEditedContent(memo.content)
      setEditedTags([...memo.tags])
      setEditedAISummary(memo.aiSummary || '')
      setTagInput('')
    }
    setHasResourceChanges(false)
    setIsEditing(false)
  }

  const handleGenerateSummary = async () => {
    const normalizedContent = normalizeContent(editedContent).trim()
    if (!normalizedContent) {
      return
    }

    setIsGeneratingSummary(true)
    try {
      const result = await summarizeText({ text: normalizedContent })
      const nextSummary = result?.summary?.trim()
      if (!nextSummary) {
        return
      }

      if (editedAISummary.trim()) {
        setPendingSummary(nextSummary)
        setIsReplaceSummaryDialogOpen(true)
        return
      }

      setEditedAISummary(nextSummary)
    } finally {
      setIsGeneratingSummary(false)
    }
  }

  const handleConfirmReplaceSummary = () => {
    if (pendingSummary) {
      setEditedAISummary(pendingSummary)
    }
    setPendingSummary('')
    setIsReplaceSummaryDialogOpen(false)
  }

  const handleCancelReplaceSummary = () => {
    setPendingSummary('')
    setIsReplaceSummaryDialogOpen(false)
  }

  const handleSave = async () => {
    if (!memo || isSaving) return

    try {
      setIsSaving(true)
      await updateMemo.mutateAsync({
        id: memo.id,
        data: {
          content: editedContent,
          tags: editedTags,
          aiSummary: editedAISummary.trim(),
          resourceIds: editingResources.map(resource => resource.id),
        },
      })
      setHasResourceChanges(false)
      setIsEditing(false)
      onUpdate?.()

      // 触发 Bot 自动回复
      try {
        await triggerReplies(memo.id)
        refetchReplies()
      } catch (err) {
        console.error('触发 Bot 回复失败:', err)
      }
    } catch (error) {
      console.error('保存失败:', error)
      toast.error('Memo保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddTag = (tag?: string) => {
    const trimmedTag = tag ? tag.trim() : tagInput.trim()
    if (trimmedTag && !editedTags.includes(trimmedTag)) {
      setEditedTags([...editedTags, trimmedTag])
      if (!tag) {
        setTagInput('')
      }
    }
  }

  const handleAddAllTags = (tagsToAdd: string[]) => {
    setEditedTags(prevTags => {
      const newTags = [...prevTags]
      tagsToAdd.forEach(tag => {
        const trimmedTag = tag.trim()
        if (trimmedTag && !newTags.includes(trimmedTag)) {
          newTags.push(trimmedTag)
        }
      })
      return newTags
    })
  }

  const handleAISuggest = async () => {
    if (!editedContent.trim()) {
      return
    }

    const result = await suggestTags({
      content: editedContent.trim(),
      existingTags: editedTags,
    })

    if (result) {
      const filtered = result.tags.filter(tag => !editedTags.includes(tag))
      setTagSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    }
  }

  const handleAddSuggestedTag = (tag: string) => {
    handleAddTag(tag)
    setTagSuggestions(prev => prev.filter(t => t !== tag))
    if (tagSuggestions.length <= 1) {
      setShowSuggestions(false)
    }
  }

  const handleAddAllSuggestedTags = () => {
    handleAddAllTags(tagSuggestions)
    setTagSuggestions([])
    setShowSuggestions(false)
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setEditedTags(editedTags.filter(tag => tag !== tagToRemove))
  }

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canAddTag) {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleDelete = async () => {
    if (!memo || isDeleting) return

    try {
      setIsDeleting(true)
      await deleteMemo.mutateAsync(memo.id)
      onDelete?.()
      onClose()
    } catch (error) {
      console.error('删除失败:', error)
      toast.error('Memo删除失败')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteResource = async () => {
    if (!resourceToDelete || !memo) return

    try {
      await resourcesApi.delete(resourceToDelete)
      setEditingResources(prev => prev.filter(resource => resource.id !== resourceToDelete))
      setImageUrls(prev => {
        const next = new Map(prev)
        next.delete(resourceToDelete)
        return next
      })
      setVideoUrls(prev => {
        const next = new Map(prev)
        next.delete(resourceToDelete)
        return next
      })
      setThumbnailUrls(prev => {
        const next = new Map(prev)
        next.delete(resourceToDelete)
        return next
      })
      setHasResourceChanges(true)
      onUpdate?.()
    } catch (error) {
      console.error('删除资源失败:', error)
      toast.error('资源删除失败')
    } finally {
      setIsDeleteResourceDialogOpen(false)
      setResourceToDelete(null)
    }
  }

  const handleUploadResources = async (files: FileList) => {
    if (!memo || isUploading) return

    const filesToUpload = Array.from(files)
    setIsUploading(true)
    try {
      const uploadedResources = await uploadFiles(filesToUpload, memo.id)

      if (uploadedResources.length > 0) {
        setEditingResources(prev => [...prev, ...uploadedResources])

        setImageUrls(prev => {
          const next = new Map(prev)
          for (const resource of uploadedResources) {
            if (resource.resourceType !== 'image') continue
            const url = resolveApiUrl(resource.url)
            if (url) {
              next.set(resource.id, url)
            }
          }
          return next
        })

        setVideoUrls(prev => {
          const next = new Map(prev)
          for (const resource of uploadedResources) {
            if (resource.resourceType !== 'video') continue
            const url = resolveApiUrl(resource.url)
            if (url) {
              next.set(resource.id, url)
            }
          }
          return next
        })

        setThumbnailUrls(prev => {
          const next = new Map(prev)
          for (const resource of uploadedResources) {
            if (!resource.thumbnailUrl) continue
            const url = resolveApiUrl(resource.thumbnailUrl)
            if (url) {
              next.set(resource.id, url)
            }
          }
          return next
        })

        setHasResourceChanges(true)
        onUpdate?.()
      }
    } catch (error) {
      console.error('上传资源失败:', error)
      toast.error('上传资源失败')
    } finally {
      setIsUploading(false)
    }
  }

  const handleReorder = (reordered: Resource[]) => {
    setEditingResources(reordered)
    setHasResourceChanges(true)
  }

  const handleUploadButtonClick = () => {
    uploadInputRef.current?.click()
  }

  const handleBotReplyClick = (reply: BotReply) => {
    setTargetReply(reply)
  }

  const hasContentChanged = editedContent !== memo?.content
  const hasTagsChanged =
    JSON.stringify([...editedTags].sort()) !== JSON.stringify([...(memo?.tags ?? [])].sort())
  const hasSummaryChanged = editedAISummary.trim() !== (memo?.aiSummary || '').trim()
  const normalizedTagInput = tagInput.trim()
  const canAddTag =
    normalizedTagInput.length > 0 &&
    !editedTags.includes(normalizedTagInput) &&
    !aiLoading &&
    !isSaving

  if (!memo) return null

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur px-6 py-4">
          <SheetTitle className="sr-only">备忘录详情</SheetTitle>
          <SheetDescription className="sr-only">查看和编辑备忘录详情</SheetDescription>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={isEditing ? handleCancelEdit : onClose}
              className="shrink-0"
              disabled={isSaving || isDeleting}
            >
              {isEditing ? <X className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{dayjs.utc(memo.createdAt).local().format('YYYY-MM-DD HH:mm')}</span>
              </div>
            </div>
            {!isEditing ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleStartEdit} disabled={isDeleting}>
                  <Edit2 className="h-4 w-4 mr-1" />
                  编辑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={isDeleting}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  删除
                </Button>
              </div>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={
                  isSaving ||
                  (!hasContentChanged &&
                    !hasTagsChanged &&
                    !hasResourceChanges &&
                    !hasSummaryChanged)
                }
              >
                <Save className="h-4 w-4 mr-1" />
                {isSaving ? '保存中...' : '保存'}
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="px-6 pb-6 pt-2 space-y-6">
          {isEditing ? (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
                <Textarea
                  value={editedContent}
                  onChange={e => setEditedContent(e.target.value)}
                  placeholder="输入内容..."
                  className="min-h-80 resize-y rounded-none border-0 bg-transparent p-4 font-mono text-sm leading-6 focus-visible:ring-0"
                />
              </div>

              <div className="space-y-3 rounded-xl border border-border/80 bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-foreground">AI 摘要</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateSummary}
                    disabled={
                      isGeneratingSummary || aiLoading || !normalizeContent(editedContent).trim()
                    }
                    className="gap-2"
                  >
                    {isGeneratingSummary || aiLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        AI生成
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  value={editedAISummary}
                  onChange={e => setEditedAISummary(e.target.value)}
                  placeholder="可手动编辑摘要，保存时会同步到 memo"
                  rows={4}
                  disabled={isSaving}
                />
              </div>

              <div className="rounded-xl border border-border/80 bg-card p-4">
                <div className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  标签
                </div>
                {editedTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {editedTags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-destructive"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      placeholder="添加标签..."
                      className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddTag()}
                      disabled={!canAddTag}
                      className={cn(
                        'rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors',
                        canAddTag ? 'hover:bg-primary/90' : 'cursor-not-allowed opacity-50'
                      )}
                    >
                      添加
                    </button>
                    {editedContent && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleAISuggest}
                        disabled={aiLoading || !editedContent.trim()}
                        className="gap-2"
                      >
                        {aiLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5" />
                            AI建议
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  {showSuggestions && tagSuggestions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-muted/30 p-2">
                      <span className="text-xs text-muted-foreground">AI建议标签：</span>
                      {tagSuggestions.map(tag => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="cursor-pointer hover:bg-primary/10 gap-1"
                          onClick={() => handleAddSuggestedTag(tag)}
                        >
                          {tag}
                          <span className="text-muted-foreground">×</span>
                        </Badge>
                      ))}
                      {tagSuggestions.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleAddAllSuggestedTags}
                          className="h-6 text-xs"
                        >
                          全部添加
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowSuggestions(false)
                          setTagSuggestions([])
                        }}
                        className="h-6 text-xs ml-auto"
                      >
                        关闭
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="prose prose-sm max-w-none">
                {normalizeContent(memo.content) ? (
                  <div className="overflow-hidden rounded-xl bg-card/55">
                    <MarkdownPreview
                      content={memo.content}
                      className="p-4 prose-p:my-1 prose-headings:my-1 prose-ul:my-1 prose-ol:my-1"
                    />
                  </div>
                ) : (
                  <></>
                )}
              </div>

              <div className="space-y-2 rounded-xl bg-muted/20 p-4">
                <div className="text-sm font-medium text-foreground">AI 摘要</div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {memo.aiSummary?.trim() ? memo.aiSummary : '暂无摘要'}
                </p>
              </div>
            </>
          )}

          {(imageResources.length > 0 || videoResources.length > 0 || isEditing) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 text-sm font-medium text-foreground">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  <span>图像 ({displayResources.length})</span>
                </div>
                {isEditing && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleUploadButtonClick}
                      disabled={isUploading}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      {isUploading ? '上传中...' : '上传资源'}
                    </Button>
                    <input
                      ref={uploadInputRef}
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={e => {
                        if (e.target.files) {
                          handleUploadResources(e.target.files)
                          e.target.value = ''
                        }
                      }}
                      className="hidden"
                    />
                  </>
                )}
              </div>
              <MemoImageGrid
                resources={[...imageResources, ...videoResources]}
                imageUrls={imageUrls}
                videoUrls={videoUrls}
                thumbnailUrls={thumbnailUrls}
                isEditing={isEditing}
                isUploading={isUploading}
                onReorder={handleReorder}
                onDelete={resourceId => {
                  setResourceToDelete(resourceId)
                  setIsDeleteResourceDialogOpen(true)
                }}
              />
            </div>
          )}

          {memo.tags && memo.tags.length > 0 && !isEditing && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Tag className="h-4 w-4" />
                <span>标签</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {memo.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center rounded-full bg-primary/10 text-primary px-3 py-1 text-sm font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!isEditing && memo?.id && (
            <div className="space-y-4 pt-4 border-t">
              <BotReplyList
                memoId={memo.id}
                onReply={handleBotReplyClick}
                onMemoNavigate={onMemoNavigate}
              />
              <BotThreadPanel
                reply={targetReply}
                open={Boolean(targetReply)}
                onClose={() => {
                  setTargetReply(null)
                  void refetchReplies()
                }}
              />
            </div>
          )}
        </div>
      </SheetContent>
      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={open => !isDeleting && setIsDeleteDialogOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除 memo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">确定要删除这条 memo 吗？此操作不可撤销</p>
          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                await handleDelete()
                setIsDeleteDialogOpen(false)
              }}
              disabled={isDeleting}
            >
              {isDeleting ? '删除中...' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isDeleteResourceDialogOpen} onOpenChange={setIsDeleteResourceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除资源</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">确定要删除这个资源吗？此操作不可撤销</p>
          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteResourceDialogOpen(false)}
            >
              取消
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteResource}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isReplaceSummaryDialogOpen} onOpenChange={setIsReplaceSummaryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>替换AI摘要</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">已有摘要内容，是否使用新生成的摘要替换？</p>
          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleCancelReplaceSummary}>
              取消
            </Button>
            <Button size="sm" onClick={handleConfirmReplaceSummary}>
              替换
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}
