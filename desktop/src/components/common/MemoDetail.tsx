import { MemoImageGrid } from '@/components/common/MemoImageGrid'
import { RichTextEditor } from '@/components/common/RichTextEditor'
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
import { useAI } from '@/hooks/use-ai'
import { toast } from '@/hooks/use-toast'
import type { MemoWithResources, Resource } from '@/types/memo'
import { assetCommands, memoCommands } from '@/utils/callRust'
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
    X,
} from 'lucide-react'
import { useEffect, useState } from 'react'

dayjs.extend(utc)

interface MemoDetailProps {
  memo: MemoWithResources | null
  open: boolean
  onClose: () => void
  onUpdate?: () => void
  onDelete?: () => void
}

export function MemoDetail({ memo, open, onClose, onUpdate, onDelete }: MemoDetailProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const [editedTags, setEditedTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleteResourceDialogOpen, setIsDeleteResourceDialogOpen] = useState(false)
  const [resourceToDelete, setResourceToDelete] = useState<string | null>(null)
  const [reorderedImageResources, setReorderedImageResources] = useState<Resource[]>([])
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map())
  const { suggestTags, loading: aiLoading } = useAI()

  const imageResources = memo?.resources.filter(r => r.resourceType === 'image') || []

  useEffect(() => {
    if (!memo) {
      setIsEditing(false)
      setEditedContent('')
      return
    }

    if (!isEditing) {
      setEditedContent(memo.content)
    }

    setReorderedImageResources(imageResources)

    const loadResources = async () => {
      const newImageUrls = new Map<string, string>()

      for (const resource of memo.resources) {
        try {
          const fileData = await assetCommands.readImageFile(resource.filename)
          const uint8Array = new Uint8Array(fileData)
          const blob = new Blob([uint8Array], { type: resource.mimeType })
          const url = URL.createObjectURL(blob)

          if (resource.resourceType === 'image') {
            newImageUrls.set(resource.id, url)
          }
        } catch (error) {
          console.error(`加载资源失败 ${resource.filename}:`, error)
        }
      }

      setImageUrls(newImageUrls)
    }

    loadResources()

    return () => {
      setImageUrls(prev => {
        prev.forEach(url => URL.revokeObjectURL(url))
        return new Map()
      })
    }
  }, [memo, isEditing])

  const handleStartEdit = () => {
    if (memo) {
      setEditedContent(memo.content)
      setEditedTags([...memo.tags])
      setTagInput('')
      setReorderedImageResources(imageResources)
      setIsEditing(true)
    }
  }

  const handleCancelEdit = () => {
    if (memo) {
      setEditedContent(memo.content)
      setEditedTags([...memo.tags])
      setTagInput('')
    }
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (!memo || isSaving) return

    try {
      setIsSaving(true)
      await memoCommands.updateMemo({
        id: memo.id,
        content: editedContent,
        tags: editedTags,
      })
      setIsEditing(false)
      onUpdate?.()
      toast.success('Memo保存成功')
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
      content: editedContent.replace(/<[^>]*>/g, '').trim(),
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
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleDelete = async () => {
    if (!memo || isDeleting) return

    try {
      setIsDeleting(true)
      await memoCommands.deleteMemo(memo.id)
      onDelete?.()
      onClose()
      toast.success('Memo删除成功')
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
      await assetCommands.deleteAssetFile(resourceToDelete)
      onUpdate?.()
      toast.success('资源删除成功')
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

    setIsUploading(true)
    try {
      const uploadedFiles: string[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const arrayBuffer = await file.arrayBuffer()
        const uint8Array = Array.from(new Uint8Array(arrayBuffer))

        const tempFilePath = await assetCommands.saveTempFile(file.name, uint8Array)
        const uploadedResources = await assetCommands.uploadFiles([tempFilePath], memo.id)

        if (uploadedResources.length > 0) {
          uploadedFiles.push(uploadedResources[0].filename)
        }
      }

      if (uploadedFiles.length > 0) {
        onUpdate?.()
        toast.success(`成功添加 ${uploadedFiles.length} 个资源`)
      }
    } catch (error) {
      console.error('上传资源失败:', error)
      toast.error('上传资源失败')
    } finally {
      setIsUploading(false)
    }
  }

  const handleReorder = (reordered: Resource[]) => {
    setReorderedImageResources(reordered)
  }

  if (!memo) return null

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-10 bg-background border-b px-6 py-4">
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
                  (editedContent === memo.content &&
                    JSON.stringify(editedTags.sort()) === JSON.stringify(memo.tags.sort()) &&
                    JSON.stringify(reorderedImageResources.map(r => r.id)) ===
                      JSON.stringify(imageResources.map(r => r.id)))
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
              <RichTextEditor
                content={editedContent}
                onChange={setEditedContent}
                placeholder="输入内容..."
                editable={true}
                className="border border-t-0"
              />

              <div className="border rounded-lg p-4">
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
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      placeholder="添加标签..."
                      className="flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddTag()}
                      className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
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
                    <div className="flex flex-wrap items-center gap-2 p-2 border rounded-md bg-muted/30">
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
            <div className="prose prose-sm max-w-none">
              {memo.content ? (
                <RichTextEditor
                  content={memo.content}
                  onChange={() => {}}
                  editable={false}
                  className="prose-sm prose-p:my-1 prose-headings:my-1 prose-ul:my-1 prose-ol:my-1 border"
                />
              ) : (
                <></>
              )}
            </div>
          )}

          {imageResources.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ImageIcon className="h-4 w-4" />
                <span>图片 ({imageResources.length})</span>
              </div>
              <MemoImageGrid
                resources={imageResources}
                imageUrls={imageUrls}
                isEditing={isEditing}
                isUploading={isUploading}
                onReorder={handleReorder}
                onDelete={resourceId => {
                  setResourceToDelete(resourceId)
                  setIsDeleteResourceDialogOpen(true)
                }}
                onUpload={handleUploadResources}
              />
            </div>
          )}

          {isEditing && imageResources.length === 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ImageIcon className="h-4 w-4" />
                <span>图片</span>
              </div>
              <MemoImageGrid
                resources={[]}
                imageUrls={imageUrls}
                isEditing={isEditing}
                isUploading={isUploading}
                onUpload={handleUploadResources}
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
    </Sheet>
  )
}
