import { useBotReplies } from '@/lib/query'
import { useThemeStore } from '@/stores/themeStore'
import type { BotReply } from '@mosaic/api'
import { StyleSheet, View } from 'react-native'
import Animated, { Easing, FadeIn } from 'react-native-reanimated'
import { SkeletonLine } from '@/components/ui/Skeleton'
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
  const { data: allReplies, isLoading } = useBotReplies(memoId)

  const replies =
    revisionNumber != null
      ? (allReplies ?? []).filter(r => r.revisionNumber == null || r.revisionNumber === revisionNumber)
      : (allReplies ?? [])

  // Loading state: show placeholder to reserve space
  if (isLoading) {
    return (
      <View style={[styles.section, { borderTopColor: theme.border }]}>
        <View style={styles.loadingPlaceholder}>
          <SkeletonLine width={120} height={12} />
          <SkeletonLine width="90%" height={12} style={{ marginTop: 8 }} />
          <SkeletonLine width="60%" height={12} style={{ marginTop: 6 }} />
        </View>
      </View>
    )
  }

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
          <BotReplyCard reply={reply} onReply={onReply} onMemoNavigate={onMemoNavigate} />
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
