import { cn } from '@/lib/utils'
import { memoryApi } from '@mosaic/api'
import type { BotReply, MemoryContext } from '@mosaic/api'
import dayjs from 'dayjs'
import { ArrowRight, FileText, Lightbulb, MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AuthImage } from '../common/AuthImage'

interface BotReplyCardProps {
  reply: BotReply
  onReply?: (reply: BotReply) => void
  onMemoNavigate?: (memoId: string) => void
  isThread?: boolean
}

function MemoryContextPanel({
  memoId,
  botId,
  onMemoNavigate,
}: {
  memoId: string
  botId: string
  onMemoNavigate?: (memoId: string) => void
}) {
  const [context, setContext] = useState<MemoryContext | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    memoryApi
      .getContext(memoId, botId)
      .then(setContext)
      .catch(() => setContext({ retrievedMemos: [] }))
  }, [memoId, botId])

  if (!context) return null

  const hasMemos = context.retrievedMemos.length > 0

  if (!hasMemos) return null

  return (
    <div className="border-t pt-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
      >
        {hasMemos && <span>参考了你 {context.retrievedMemos.length} 条以前的记录</span>}
      </button>

      {open && hasMemos && (
        <div className="mt-1.5 space-y-px">
          {context.retrievedMemos.map(memo => (
            <button
              key={memo.id}
              type="button"
              onClick={() => onMemoNavigate?.(memo.id)}
              className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50 transition-colors group"
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 text-xs text-foreground truncate">{memo.excerpt}</span>
              <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                {dayjs(memo.createdAt).format('M月D日')}
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function BotReplyCard({
  reply,
  onReply,
  onMemoNavigate,
  isThread = false,
}: BotReplyCardProps) {
  const threadCount = Math.max(reply.threadCount - 1, 0)
  const [thinkingExpanded, setThinkingExpanded] = useState(false)

  return (
    <div className={cn('flex gap-3', isThread && 'ml-3 pl-6 border-l-2 border-muted')}>
      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-primary text-primary-foreground">
        {reply.bot.avatarUrl ? (
          <AuthImage
            src={reply.bot.avatarUrl}
            alt={reply.bot.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs">
            {reply.bot.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        {reply.userQuestion && (
          <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
            {reply.userQuestion}
          </div>
        )}
        <div className="bg-card border rounded-lg px-3 py-2 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium truncate">{reply.bot.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {dayjs(reply.createdAt).format('MM-DD HH:mm')}
              </span>
            </div>
            {!isThread && onReply && (
              <button
                type="button"
                onClick={() => onReply(reply)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0 transition-colors"
              >
                <MessageCircle className="h-3 w-3" />
                回复
              </button>
            )}
          </div>
          <p className="text-sm whitespace-pre-wrap text-foreground">{reply.content}</p>
          {reply.thinkingContent && (
            <div className="border-t pt-2">
              <button
                type="button"
                onClick={() => setThinkingExpanded(!thinkingExpanded)}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                心路历程
              </button>
              {thinkingExpanded && (
                <div className="mt-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                  {reply.thinkingContent}
                </div>
              )}
            </div>
          )}
          {!isThread && (
            <MemoryContextPanel
              memoId={reply.memoId}
              botId={reply.bot.id}
              onMemoNavigate={onMemoNavigate}
            />
          )}
        </div>
        {threadCount > 0 && !isThread && (
          <div className="text-xs text-muted-foreground">已追问 {threadCount} 轮</div>
        )}
      </div>
    </div>
  )
}
