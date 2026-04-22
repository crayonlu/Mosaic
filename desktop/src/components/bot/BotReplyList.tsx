import type { BotReply } from '@mosaic/api'
import { useBotReplies } from '@mosaic/api'
import { Loader2, MessageSquare } from 'lucide-react'
import { BotReplyCard } from './BotReplyCard'

interface BotReplyListProps {
  memoId: string
  onReply: (reply: BotReply) => void
}

export function BotReplyList({ memoId, onReply }: BotReplyListProps) {
  const { data: replies, isLoading } = useBotReplies(memoId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!replies || replies.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <MessageSquare className="h-4 w-4" />
        <span>AI 评论</span>
        <span className="text-xs text-muted-foreground">({replies.length})</span>
      </div>
      <div className="space-y-4">
        {replies.map(reply => (
          <BotReplyCard key={reply.id} reply={reply} onReply={onReply} />
        ))}
      </div>
    </div>
  )
}
