import { AuthImage } from '@/components/common/AuthImage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/useToast'
import { toBrowserUploadFile } from '@/utils/mediaFile'
import type { Bot } from '@mosaic/api'
import { resourcesApi } from '@mosaic/api'
import * as Switch from '@radix-ui/react-switch'
import { ArrowLeft, Camera, Loader2, Save, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface BotSheetProps {
  bot?: Bot | null
  open: boolean
  onClose: () => void
  onSave: (data: {
    name: string
    description: string
    tags: string[]
    autoReply: boolean
    visionEnabled: boolean
    avatarUrl?: string
  }) => void
  isPending: boolean
}

export function BotSheet({ bot, open, onClose, onSave, isPending }: BotSheetProps) {
  const [name, setName] = useState(bot?.name ?? '')
  const [description, setDescription] = useState(bot?.description ?? '')
  const [tagsInput, setTagsInput] = useState(bot?.tags.join(' ') ?? '')
  const [autoReply, setAutoReply] = useState(bot?.autoReply ?? true)
  const [visionEnabled, setVisionEnabled] = useState(bot?.visionEnabled ?? false)
  const [avatarUrl, setAvatarUrl] = useState(bot?.avatarUrl ?? '')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [dirty, setDirty] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && bot) {
      setName(bot.name ?? '')
      setDescription(bot.description ?? '')
      setTagsInput(bot.tags?.join(' ') ?? '')
      setAutoReply(bot.autoReply ?? true)
      setVisionEnabled(bot.visionEnabled ?? false)
      setAvatarUrl(bot.avatarUrl ?? '')
      setAvatarPreview(null)
      setDirty(false)
    } else if (open) {
      setName('')
      setDescription('')
      setTagsInput('')
      setAutoReply(true)
      setVisionEnabled(false)
      setAvatarUrl('')
      setAvatarPreview(null)
      setDirty(false)
    }
  }, [open, bot])

  const handleNameChange = (v: string) => {
    setName(v)
    setDirty(true)
  }

  const handleDescChange = (v: string) => {
    setDescription(v)
    setDirty(true)
  }

  const handleTagsChange = (v: string) => {
    setTagsInput(v)
    setDirty(true)
  }

  const handleAutoReplyChange = (v: boolean) => {
    setAutoReply(v)
    setDirty(true)
  }

  const handleVisionEnabledChange = (v: boolean) => {
    setVisionEnabled(v)
    setDirty(true)
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('图片大小不能超过 5MB')
      return
    }

    const preview = URL.createObjectURL(file)
    setAvatarPreview(preview)
    setDirty(true)

    try {
      setIsUploadingAvatar(true)
      const resource = await resourcesApi.upload(toBrowserUploadFile(file))
      const url = resourcesApi.getDownloadUrl(resource.id)
      setAvatarUrl(url)
    } catch (err) {
      console.error(err)
      toast.error('头像上传失败')
      setAvatarPreview(null)
      setAvatarUrl(bot?.avatarUrl ?? '')
    } finally {
      setIsUploadingAvatar(false)
      e.target.value = ''
    }
  }

  const handleRemoveAvatar = () => {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview)
    }
    setAvatarPreview(null)
    setAvatarUrl('')
    setDirty(true)
  }

  const handleClose = () => {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview)
    }
    onClose()
  }

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('请输入 Bot 名称')
      return
    }
    const tags = tagsInput
      .split(/[\s,，]+/)
      .map(t => t.replace(/^#/, '').trim())
      .filter(Boolean)
    onSave({
      name: name.trim(),
      description: description.trim(),
      tags,
      autoReply,
      visionEnabled,
      avatarUrl: avatarUrl || undefined,
    })
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur px-6 py-4">
          <SheetTitle className="sr-only">{bot ? '编辑 Bot' : '新建 Bot'}</SheetTitle>
          <SheetDescription className="sr-only">
            {bot ? '修改 Bot 的配置信息' : '创建一个新的 AI Bot 伴侣'}
          </SheetDescription>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="shrink-0"
              disabled={isPending}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <span className="text-lg font-semibold truncate block">
                {bot ? '编辑 Bot' : '新建 Bot'}
              </span>
            </div>
            <Button size="sm" onClick={handleSave} disabled={isPending || !dirty}>
              <Save className="h-4 w-4 mr-1" />
              保存
            </Button>
          </div>
        </SheetHeader>

        <div className="px-6 py-4 space-y-6">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleAvatarClick}
              className="relative group"
              disabled={isPending}
            >
              <div className="h-20 w-20 rounded-full bg-muted border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden group-hover:border-primary/50 transition-colors">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                ) : avatarUrl ? (
                  <AuthImage src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-8 w-8 text-muted-foreground/50" />
                )}
                {isUploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                )}
              </div>
              {(avatarPreview || avatarUrl) && !isUploadingAvatar && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    handleRemoveAvatar()
                  }}
                  className="absolute top-0 right-0 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bot-name">名称</Label>
            <Input
              id="bot-name"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="例如：心情助手"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bot-desc">描述</Label>
            <Textarea
              id="bot-desc"
              value={description}
              onChange={e => handleDescChange(e.target.value)}
              placeholder="描述这个 Bot 的角色和风格..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bot-tags">标签（用空格分隔）</Label>
            <Input
              id="bot-tags"
              value={tagsInput}
              onChange={e => handleTagsChange(e.target.value)}
              placeholder="情绪 日常 反思"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">自动回复</Label>
              <p className="text-sm text-muted-foreground">创建 Memo 后自动触发该 Bot 回复</p>
            </div>
            <Switch.Root
              checked={autoReply}
              onCheckedChange={handleAutoReplyChange}
              className="peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
            >
              <Switch.Thumb className="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
            </Switch.Root>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">图片理解</Label>
              <p className="text-sm text-muted-foreground">
                允许这个 Bot 在回复时读取 Memo 或追问里的图片
              </p>
            </div>
            <Switch.Root
              checked={visionEnabled}
              onCheckedChange={handleVisionEnabledChange}
              className="peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
            >
              <Switch.Thumb className="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
            </Switch.Root>
          </div>

          {isPending && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                {bot ? '正在保存...' : '正在创建...'}
              </span>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
