import { cn } from '@/lib/utils'
import type { BotReply } from '@mosaic/api'
import dayjs from 'dayjs'
import { MessageCircle, Lightbulb } from 'lucide-react'
import { useState } from 'react'
import { AuthImage } from '../common/AuthImage'

interface BotReplyCardProps {
  reply: BotReply
  onReply?: (reply: BotReply) => void
  isThread?: boolean
}

export function BotReplyCard({ reply, onReply, isThread = false }: BotReplyCardProps) {
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
        </div>
        {threadCount > 0 && !isThread && (
          <div className="text-xs text-muted-foreground">已追问 {threadCount} 轮</div>
        )}
      </div>
    </div>
  )
}
