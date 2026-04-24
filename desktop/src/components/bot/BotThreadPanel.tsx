import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { AuthImage } from '@/components/common/AuthImage'
import { toast } from '@/hooks/useToast'
import { uploadFiles } from '@/hooks/useFileUpload'
import { loadAIConfig } from '@/utils/settingsHelpers'
import type { AIConfig } from '@/types/settings'
import { resourcesApi, type BotReply } from '@mosaic/api'
import { useBotThread, useReplyToBot } from '@mosaic/api'
import { ImagePlus, Lightbulb, Loader2, Send, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface PendingMessage {
  id: string
  role: 'user'
  content: string
  previewUrls?: string[]
}

interface BotThreadPanelProps {
  reply: BotReply | null
  open: boolean
  onClose: () => void
}

function LocalFileThumb({ file }: { file: File }) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    const nextUrl = URL.createObjectURL(file)
    setUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [file])

  return url ? <img src={url} alt="" className="h-full w-full object-cover" /> : null
}

export function BotThreadPanel({ reply, open, onClose }: BotThreadPanelProps) {
  const { data: thread, isLoading } = useBotThread(reply?.latestReplyId ?? reply?.id)
  const { mutateAsync: replyToBot, isPending } = useReplyToBot()
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null)
  const [pendingMessage, setPendingMessage] = useState<PendingMessage | null>(null)
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const bot = thread?.bot ?? reply?.bot
  const latestReplyId = thread?.latestReplyId ?? reply?.latestReplyId ?? reply?.id
  const messages = pendingMessage
    ? [...(thread?.messages ?? []), pendingMessage]
    : (thread?.messages ?? [])

  useEffect(() => {
    if (open) {
      void loadAIConfig().then(setAiConfig)
    } else {
      setText('')
      setFiles([])
      setPendingMessage(null)
    }
  }, [open])

  useEffect(() => {
    const urls = pendingMessage?.previewUrls ?? []
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [pendingMessage])

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

    const sentText = question || '请根据图片内容继续回复。'
    const sentFiles = files

    setText('')
    setFiles([])
    setPendingMessage({
      id: `pending-${Date.now()}`,
      role: 'user',
      content: sentText,
      previewUrls: sentFiles.map(file => URL.createObjectURL(file)),
    })

    try {
      const uploaded = sentFiles.length > 0 ? await uploadFiles(sentFiles) : []
      await replyToBot({
        replyId: latestReplyId,
        data: {
          question: sentText,
          resourceIds: uploaded.map(resource => resource.id),
        },
        aiHeaders: {
          'x-ai-provider': config.provider,
          'x-ai-base-url': config.baseUrl,
          'x-ai-api-key': config.apiKey,
          'x-ai-model': config.model ?? '',
        },
      })
      setPendingMessage(null)
    } catch (error) {
      console.error(error)
      setText(question)
      setFiles(sentFiles)
      setPendingMessage(null)
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
            <>
              {messages.map((message, index) => {
                const isUser = message.role === 'user'
                return (
                  <div
                    key={`${message.id}-${message.role}-${index}`}
                    className={isUser ? 'flex justify-end' : 'flex justify-start'}
                  >
                    <div
                      className={
                        isUser
                          ? 'max-w-[82%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground'
                          : 'max-w-[82%] rounded-2xl border bg-card px-3 py-2 text-sm text-foreground'
                      }
                    >
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      {'thinkingContent' in message && message.thinkingContent && (
                        <div className="mt-2 border-t pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedThinking(prev => {
                                const next = new Set(prev)
                                if (next.has(message.id)) next.delete(message.id)
                                else next.add(message.id)
                                return next
                              })
                            }}
                            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Lightbulb className="h-3.5 w-3.5" />
                            心路历程
                          </button>
                          {expandedThinking.has(message.id) && (
                            <div className="mt-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                              {message.thinkingContent}
                            </div>
                          )}
                        </div>
                      )}
                      {'resourceIds' in message && message.resourceIds.length > 0 && (
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          {message.resourceIds.map(resourceId => (
                            <div
                              key={resourceId}
                              className="h-24 overflow-hidden rounded-xl bg-black/10"
                            >
                              <AuthImage
                                src={resourcesApi.getDownloadUrl(resourceId)}
                                variant="thumb"
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      {'previewUrls' in message &&
                        message.previewUrls &&
                        message.previewUrls.length > 0 && (
                          <div className="mt-2 grid grid-cols-2 gap-1.5">
                            {message.previewUrls.map(previewUrl => (
                              <img
                                key={previewUrl}
                                src={previewUrl}
                                alt=""
                                className="h-24 rounded-xl object-cover"
                              />
                            ))}
                          </div>
                        )}
                    </div>
                  </div>
                )
              })}
              {isPending && (
                <div className="flex justify-start">
                  <div className="max-w-[82%] rounded-2xl border bg-card px-3 py-2 text-sm text-muted-foreground">
                    正在回复...
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t bg-background/95 p-4 space-y-3">
          {files.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {files.map(file => (
                <div
                  key={`${file.name}-${file.lastModified}`}
                  className="group relative aspect-square overflow-hidden rounded-xl border bg-muted"
                >
                  <LocalFileThumb file={file} />
                  <button
                    type="button"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-foreground opacity-90 shadow-sm"
                    onClick={() => setFiles(prev => prev.filter(item => item !== file))}
                    aria-label="移除图片"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <Button
              variant="secondary"
              size="icon"
              onClick={handlePickImages}
              disabled={isPending || files.length >= 4}
            >
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
            <Input
              value={text}
              onChange={event => setText(event.target.value)}
              placeholder="继续追问..."
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
