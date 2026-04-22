import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { BotReply } from '@mosaic/api'
import dayjs from 'dayjs'
import { MessageCircle } from 'lucide-react'
import { AuthImage } from '../common/AuthImage'

interface BotReplyCardProps {
  reply: BotReply
  onReply?: (reply: BotReply) => void
  isThread?: boolean
}

export function BotReplyCard({ reply, onReply, isThread = false }: BotReplyCardProps) {
  const threadCount = Math.max(reply.threadCount - 1, 0)

  return (
    <div className={cn('flex gap-3', isThread && 'ml-3 pl-6 border-l-2 border-muted')}>
      <Avatar className="h-8 w-8 shrink-0">
        {reply.bot.avatarUrl ? <AuthImage src={reply.bot.avatarUrl} alt={reply.bot.name} /> : null}
        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
          {reply.bot.name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
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
        </div>
        {threadCount > 0 && !isThread && (
          <div className="text-xs text-muted-foreground">已追问 {threadCount} 轮</div>
        )}
      </div>
    </div>
  )
}
