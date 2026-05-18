import { useBotReplies } from '@/lib/query'
import { useThemeStore } from '@/stores/themeStore'
import type { BotReply } from '@mosaic/api'
import { StyleSheet, View } from 'react-native'
import { BotReplyCard } from './BotReplyCard'

interface BotReplyListProps {
  memoId: string
  revisionNumber?: number
  onReply: (reply: BotReply) => void
  onMemoNavigate?: (memoId: string) => void
}

export function BotReplyList({
  memoId,
  revisionNumber,
  onReply,
  onMemoNavigate,
}: BotReplyListProps) {
  const { theme } = useThemeStore()
  const { data: allReplies = [] } = useBotReplies(memoId)

  const replies =
    revisionNumber != null
      ? allReplies.filter(r => r.revisionNumber == null || r.revisionNumber === revisionNumber)
      : allReplies

  if (replies.length === 0) return null

  return (
    <View style={[styles.section, { borderTopColor: theme.border }]}>
      {replies.map((reply, index) => (
        <View
          key={reply.id}
          style={[
            styles.replyWrapper,
            index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
          ]}
        >
          <BotReplyCard reply={reply} onReply={onReply} onMemoNavigate={onMemoNavigate} />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  replyWrapper: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
})
