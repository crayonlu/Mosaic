import { useState, useRef, useEffect } from 'react'
import {
  ArrowLeft,
  Play,
  Pause,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  Calendar,
  Tag,
  Edit2,
  Save,
  X,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { RichTextEditor } from '@/components/common/RichTextEditor'
import type { MemoWithResources } from '@/types/memo'
import { assetCommands, memoCommands } from '@/utils/callRust'
import dayjs from 'dayjs'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null)
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null)
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map())
  const [audioUrls, setAudioUrls] = useState<Map<string, string>>(new Map())
  const [videoUrls, setVideoUrls] = useState<Map<string, string>>(new Map())
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)
  const audioRefsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const videoRefsRef = useRef<Map<string, HTMLVideoElement>>(new Map())

  const imageResources = memo?.resources.filter(r => r.resourceType === 'image') || []
  const audioResources = memo?.resources.filter(r => r.resourceType === 'voice') || []
  const videoResources = memo?.resources.filter(r => r.resourceType === 'video') || []
  const fileResources = memo?.resources.filter(r => r.resourceType === 'file') || []

  useEffect(() => {
    if (!memo) {
      setIsEditing(false)
      setEditedContent('')
      return
    }

    if (!isEditing) {
      setEditedContent(memo.content)
    }

    const loadResources = async () => {
      const newImageUrls = new Map<string, string>()
      const newAudioUrls = new Map<string, string>()
      const newVideoUrls = new Map<string, string>()

      for (const resource of memo.resources) {
        try {
          const fileData = await assetCommands.readImageFile(resource.filename)
          const uint8Array = new Uint8Array(fileData)
          const blob = new Blob([uint8Array], { type: resource.mimeType })
          const url = URL.createObjectURL(blob)

          if (resource.resourceType === 'image') {
            newImageUrls.set(resource.id, url)
          } else if (resource.resourceType === 'voice') {
            newAudioUrls.set(resource.id, url)
          } else if (resource.resourceType === 'video') {
            newVideoUrls.set(resource.id, url)
          }
        } catch (error) {
          console.error(`加载资源失败 ${resource.filename}:`, error)
        }
      }

      setImageUrls(newImageUrls)
      setAudioUrls(newAudioUrls)
      setVideoUrls(newVideoUrls)
    }

    loadResources()

    return () => {
      setImageUrls(prev => {
        prev.forEach(url => URL.revokeObjectURL(url))
        return new Map()
      })
      setAudioUrls(prev => {
        prev.forEach(url => URL.revokeObjectURL(url))
        return new Map()
      })
      setVideoUrls(prev => {
        prev.forEach(url => URL.revokeObjectURL(url))
        return new Map()
      })
      audioRefsRef.current.forEach(audio => {
        audio.pause()
        audio.src = ''
      })
      audioRefsRef.current.clear()
      videoRefsRef.current.forEach(video => {
        video.pause()
        video.src = ''
      })
      videoRefsRef.current.clear()
      setPlayingAudioId(null)
      setPlayingVideoId(null)
    }
  }, [memo, isEditing])

  const handleStartEdit = () => {
    if (memo) {
      setEditedContent(memo.content)
      setEditedTags([...memo.tags])
      setTagInput('')
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
    } catch (error) {
      console.error('保存失败:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim()
    if (trimmedTag && !editedTags.includes(trimmedTag)) {
      setEditedTags([...editedTags, trimmedTag])
      setTagInput('')
    }
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
    } catch (error) {
      console.error('删除失败:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleAudioPlay = async (resourceId: string) => {
    if (playingAudioId === resourceId) {
      const audio = audioRefsRef.current.get(resourceId)
      if (audio) {
        audio.pause()
        setPlayingAudioId(null)
      }
      return
    }

    audioRefsRef.current.forEach(audio => {
      audio.pause()
      audio.currentTime = 0
    })
    setPlayingAudioId(null)

    const audio = audioRefsRef.current.get(resourceId)
    if (audio) {
      try {
        await audio.play()
        setPlayingAudioId(resourceId)
      } catch (error) {
        console.error('播放音频失败:', error)
      }
    }
  }

  const handleVideoPlay = (resourceId: string) => {
    if (playingVideoId === resourceId) {
      const video = videoRefsRef.current.get(resourceId)
      if (video) {
        video.pause()
        setPlayingVideoId(null)
      }
      return
    }

    videoRefsRef.current.forEach(video => video.pause())
    setPlayingVideoId(null)

    const video = videoRefsRef.current.get(resourceId)
    if (video) {
      video.play()
      setPlayingVideoId(resourceId)
    }
  }

  const openImageModal = (index: number) => {
    setCurrentImageIndex(index)
    setIsImageModalOpen(true)
  }

  const formatTime = (timestamp: number) => {
    return dayjs.utc(timestamp).local().format('YYYY年MM月DD日 HH:mm')
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
                <span>{formatTime(memo.createdAt)}</span>
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
                    JSON.stringify(editedTags.sort()) === JSON.stringify(memo.tags.sort()))
                }
              >
                <Save className="h-4 w-4 mr-1" />
                {isSaving ? '保存中...' : '保存'}
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="px-6 py-6 space-y-6">
          {isEditing ? (
            <div className="space-y-4">
              <RichTextEditor
                content={editedContent}
                onChange={setEditedContent}
                placeholder="输入内容..."
                editable={true}
              />

              <div className="border rounded-lg p-4 bg-muted/30">
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
                    onClick={handleAddTag}
                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                  >
                    添加
                  </button>
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
                  className="prose-sm prose-p:my-1 prose-headings:my-1 prose-ul:my-1 prose-ol:my-1"
                />
              ) : (
                <span className="text-muted-foreground italic">无文字内容</span>
              )}
            </div>
          )}

          {imageResources.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ImageIcon className="h-4 w-4" />
                <span>图片 ({imageResources.length})</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {imageResources.map((resource, index) => {
                  const url = imageUrls.get(resource.id)
                  if (!url) return null
                  return (
                    <div
                      key={resource.id}
                      className="group relative rounded-lg border bg-card overflow-hidden cursor-pointer"
                      onClick={() => openImageModal(index)}
                    >
                      <img
                        src={url}
                        alt={resource.filename}
                        className="w-full h-auto object-contain max-h-96"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="text-xs text-white">{resource.filename}</div>
                        <div className="text-[10px] text-white/80 mt-1">
                          {formatSize(resource.size)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {videoResources.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <VideoIcon className="h-4 w-4" />
                <span>视频 ({videoResources.length})</span>
              </div>
              <div className="space-y-3">
                {videoResources.map(resource => {
                  const url = videoUrls.get(resource.id)
                  if (!url) return null
                  return (
                    <div
                      key={resource.id}
                      className="relative rounded-lg border bg-card overflow-hidden"
                    >
                      <video
                        ref={el => {
                          if (el) videoRefsRef.current.set(resource.id, el)
                        }}
                        src={url}
                        className="w-full"
                        onPlay={() => setPlayingVideoId(resource.id)}
                        onPause={() => setPlayingVideoId(null)}
                        onEnded={() => setPlayingVideoId(null)}
                      />
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
                        {playingVideoId !== resource.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-12 w-12 bg-black/50 hover:bg-black/70 text-white rounded-full pointer-events-auto"
                            onClick={() => handleVideoPlay(resource.id)}
                          >
                            <Play className="h-6 w-6 ml-1" />
                          </Button>
                        )}
                      </div>
                      <div className="p-3 bg-card">
                        <div className="text-sm font-medium truncate">{resource.filename}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatSize(resource.size)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {audioResources.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Play className="h-4 w-4" />
                <span>音频 ({audioResources.length})</span>
              </div>
              <div className="space-y-2">
                {audioResources.map(resource => {
                  const url = audioUrls.get(resource.id)
                  if (!url) return null
                  return (
                    <div key={resource.id} className="rounded-lg border bg-card p-4">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 rounded-full shrink-0"
                          onClick={() => handleAudioPlay(resource.id)}
                        >
                          {playingAudioId === resource.id ? (
                            <Pause className="h-5 w-5" />
                          ) : (
                            <Play className="h-5 w-5 ml-0.5" />
                          )}
                        </Button>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{resource.filename}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatSize(resource.size)}
                          </div>
                        </div>
                      </div>
                      <audio
                        ref={el => {
                          if (el) {
                            audioRefsRef.current.set(resource.id, el)
                            el.onended = () => setPlayingAudioId(null)
                            el.onpause = () => {
                              if (el.paused && playingAudioId === resource.id) {
                                setPlayingAudioId(null)
                              }
                            }
                          }
                        }}
                        src={url}
                        preload="metadata"
                        className="hidden"
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {fileResources.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileText className="h-4 w-4" />
                <span>文件 ({fileResources.length})</span>
              </div>
              <div className="space-y-2">
                {fileResources.map(resource => (
                  <div key={resource.id} className="rounded-lg border bg-card p-4">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{resource.filename}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatSize(resource.size)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {memo.tags && memo.tags.length > 0 && (
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

        {isImageModalOpen && imageResources.length > 0 && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setIsImageModalOpen(false)}
          >
            <div className="relative max-w-5xl max-h-[90vh]">
              <img
                src={imageUrls.get(imageResources[currentImageIndex]?.id) || ''}
                alt={imageResources[currentImageIndex]?.filename}
                className="max-w-full max-h-[90vh] object-contain"
                onClick={e => e.stopPropagation()}
              />
              {imageResources.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                    onClick={e => {
                      e.stopPropagation()
                      setCurrentImageIndex(prev =>
                        prev > 0 ? prev - 1 : imageResources.length - 1
                      )
                    }}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                    onClick={e => {
                      e.stopPropagation()
                      setCurrentImageIndex(prev =>
                        prev < imageResources.length - 1 ? prev + 1 : 0
                      )
                    }}
                  >
                    <ArrowLeft className="h-5 w-5 rotate-180" />
                  </Button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                    {currentImageIndex + 1} / {imageResources.length}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </SheetContent>
      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={open => !isDeleting && setIsDeleteDialogOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除 memo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">确定要删除这条 memo 吗？此操作不可撤销。</p>
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
    </Sheet>
  )
}
