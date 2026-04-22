import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { toast } from '@/hooks/useToast'
import { uploadFiles } from '@/hooks/useFileUpload'
import { loadAIConfig } from '@/utils/settingsHelpers'
import type { AIConfig } from '@/types/settings'
import type { BotReply } from '@mosaic/api'
import { useBotThread, useReplyToBot } from '@mosaic/api'
import { ImagePlus, Loader2, Send, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface BotThreadPanelProps {
  reply: BotReply | null
  open: boolean
  onClose: () => void
}

export function BotThreadPanel({ reply, open, onClose }: BotThreadPanelProps) {
  const { data: thread, isLoading } = useBotThread(reply?.latestReplyId ?? reply?.id)
  const { mutateAsync: replyToBot, isPending } = useReplyToBot()
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const bot = thread?.bot ?? reply?.bot
  const latestReplyId = thread?.latestReplyId ?? reply?.latestReplyId ?? reply?.id

  useEffect(() => {
    if (open) {
      void loadAIConfig().then(setAiConfig)
    }
  }, [open])

  const handlePickImages = () => {
    fileInputRef.current?.click()
  }

  const handleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []).filter(file =>
      file.type.startsWith('image/')
    )
    const next = [...files, ...selected].slice(0, 4)
    if (files.length + selected.length > 4) {
      toast.error('最多添加 4 张图片')
    }
    setFiles(next)
    event.target.value = ''
  }

  const handleSend = async () => {
    const question = text.trim()
    if (!latestReplyId || (!question && files.length === 0) || isPending) return

    const config = await loadAIConfig()
    if (!config?.apiKey || !config.model) {
      toast.error('AI 功能未配置')
      return
    }

    try {
      const uploaded = files.length > 0 ? await uploadFiles(files) : []
      await replyToBot({
        replyId: latestReplyId,
        data: {
          question: question || '请根据图片内容继续回复。',
          resourceIds: uploaded.map(resource => resource.id),
        },
        aiHeaders: {
          'x-ai-provider': config.provider,
          'x-ai-base-url': config.baseUrl,
          'x-ai-api-key': config.apiKey,
          'x-ai-model': config.model ?? '',
          'x-ai-supports-vision': config.supportsVision ? 'true' : 'false',
        },
      })
      setText('')
      setFiles([])
    } catch (error) {
      console.error(error)
      toast.error('追问失败')
    }
  }

  return (
    <Sheet open={open} onOpenChange={value => !value && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{bot?.name ?? 'Bot'}</SheetTitle>
          <SheetDescription>围绕这条 Memo 继续聊</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            thread?.messages.map((message, index) => {
              const isUser = message.role === 'user'
              return (
                <div
                  key={`${message.id}-${message.role}-${index}`}
                  className={isUser ? 'flex justify-end' : 'flex justify-start'}
                >
                  <div
                    className={
                      isUser
                        ? 'max-w-[82%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground whitespace-pre-wrap'
                        : 'max-w-[82%] rounded-2xl border bg-card px-3 py-2 text-sm text-foreground whitespace-pre-wrap'
                    }
                  >
                    {message.content}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="border-t p-4 space-y-3">
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map(file => (
                <span
                  key={`${file.name}-${file.lastModified}`}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground"
                >
                  {file.name}
                  <button
                    type="button"
                    onClick={() => setFiles(prev => prev.filter(item => item !== file))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            {bot?.visionEnabled && aiConfig?.supportsVision && (
              <>
                <Button variant="ghost" size="icon" onClick={handlePickImages} disabled={isPending}>
                  <ImagePlus className="h-4 w-4" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFilesChange}
                />
              </>
            )}
            <Input
              value={text}
              onChange={event => setText(event.target.value)}
              placeholder="继续追问..."
              disabled={isPending}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void handleSend()
                }
              }}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={isPending || (!text.trim() && files.length === 0)}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
