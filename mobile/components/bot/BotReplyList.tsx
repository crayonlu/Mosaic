import { useAuthHeaders } from '@/hooks/useAuthHeaders'
import { useThemeStore } from '@/stores/themeStore'
import type { BotReply } from '@mosaic/api'
import { StyleSheet, View } from 'react-native'
import Animated, { Easing, FadeIn } from 'react-native-reanimated'
import { BotReplyCard } from './BotReplyCard'

interface BotReplyListProps {
  replies: BotReply[]
  revisionNumber?: number
  onReply: (reply: BotReply) => void
  onMemoNavigate?: (memoId: string) => void
}

export function BotReplyList({
  replies: allReplies,
  revisionNumber,
  onReply,
  onMemoNavigate,
}: BotReplyListProps) {
  const { theme } = useThemeStore()
  const authHeaders = useAuthHeaders()

  const replies =
    revisionNumber != null
      ? (allReplies ?? []).filter(
          r => r.revisionNumber == null || r.revisionNumber === revisionNumber
        )
      : (allReplies ?? [])

  if (replies.length === 0) return null

  return (
    <Animated.View
      entering={FadeIn.duration(200).easing(Easing.out(Easing.cubic))}
      style={[styles.section, { borderTopColor: theme.border }]}
    >
      {replies.map((reply, index) => (
        <View
          key={reply.id}
          style={[
            styles.replyWrapper,
            index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
          ]}
        >
          <BotReplyCard
            reply={reply}
            onReply={onReply}
            onMemoNavigate={onMemoNavigate}
            authHeaders={authHeaders}
          />
        </View>
      ))}
    </Animated.View>
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
  loadingPlaceholder: {
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
})
