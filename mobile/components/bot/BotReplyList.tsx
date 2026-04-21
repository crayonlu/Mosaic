import { useBotReplies } from '@/lib/query'
import { useThemeStore } from '@/stores/themeStore'
import type { BotReply } from '@mosaic/api'
import { StyleSheet, View } from 'react-native'
import { BotReplyCard } from './BotReplyCard'

interface BotReplyListProps {
  memoId: string
  onReply: (reply: BotReply) => void
}

export function BotReplyList({ memoId, onReply }: BotReplyListProps) {
  const { theme } = useThemeStore()
  const { data: replies = [] } = useBotReplies(memoId)

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
          <BotReplyCard reply={reply} onReply={onReply} />
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
