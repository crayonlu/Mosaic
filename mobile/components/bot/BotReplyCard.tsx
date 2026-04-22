import { stringUtils } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import type { BotReply } from '@mosaic/api'
import { Image } from 'expo-image'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

interface BotReplyCardProps {
  reply: BotReply
  onReply: (reply: BotReply) => void
  isThread?: boolean
}

export function BotReplyCard({ reply, onReply, isThread = false }: BotReplyCardProps) {
  const { theme } = useThemeStore()
  const threadCount = Math.max(reply.threadCount - 1, 0)

  return (
    <View style={[styles.container, isThread && styles.threadContainer]}>
      {isThread && <View style={[styles.threadLine, { backgroundColor: theme.border }]} />}
      <View style={{ flex: 1 }}>
        {reply.userQuestion && (
          <View
            style={[
              styles.questionBubble,
              { backgroundColor: theme.surfaceMuted, borderRadius: theme.radius.small },
            ]}
          >
            <Text style={[styles.questionText, { color: theme.textSecondary }]}>
              {reply.userQuestion}
            </Text>
          </View>
        )}
        <TouchableOpacity onPress={() => onReply(reply)} activeOpacity={0.85}>
          <View
            style={[
              styles.bubble,
              { backgroundColor: theme.surface, borderRadius: theme.radius.medium },
            ]}
          >
            <View style={styles.header}>
              <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                {reply.bot.avatarUrl ? (
                  <Image
                    source={{ uri: reply.bot.avatarUrl }}
                    style={styles.avatarImg}
                    contentFit="cover"
                  />
                ) : (
                  <Text style={[styles.avatarText, { color: theme.onPrimary }]}>
                    {reply.bot.name.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <Text style={[styles.botName, { color: theme.text }]}>{reply.bot.name}</Text>
              <Text style={[styles.time, { color: theme.textTertiary }]}>
                {stringUtils.formatRelativeTime(reply.createdAt)}
              </Text>
              {!isThread && (
                <Text style={[styles.replyBtn, { color: theme.textSecondary }]}>继续聊</Text>
              )}
            </View>
            <Text style={[styles.content, { color: theme.text }]}>{reply.content}</Text>
            {!isThread && threadCount > 0 && (
              <Text style={[styles.threadHint, { color: theme.textSecondary }]}>
                已追问 {threadCount} 轮
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  threadContainer: {
    marginTop: 8,
    paddingLeft: 8,
  },
  threadLine: {
    width: 2,
    borderRadius: 1,
    marginRight: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  bubble: {
    padding: 12,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '700',
  },
  avatarImg: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  botName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  time: {
    fontSize: 11,
  },
  replyBtn: {
    fontSize: 12,
    paddingLeft: 4,
  },
  threadHint: {
    fontSize: 12,
  },
  content: {
    fontSize: 14,
    lineHeight: 21,
  },
  questionBubble: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  questionText: {
    fontSize: 13,
    lineHeight: 19,
  },
})
