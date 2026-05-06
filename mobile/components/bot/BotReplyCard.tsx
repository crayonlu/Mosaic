import { getBearerAuthHeaders } from '@/lib/services/apiAuth'
import { stringUtils } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import type { BotReply, MemoryContext } from '@mosaic/api'
import { memoryApi } from '@mosaic/api'
import dayjs from 'dayjs'
import { Image } from 'expo-image'
import { ArrowRight, ChevronDown, ChevronUp, FileText, Lightbulb } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

interface BotReplyCardProps {
  reply: BotReply
  onReply: (reply: BotReply) => void
  onMemoNavigate?: (memoId: string) => void
  isThread?: boolean
}

function MemoryContextPanel({
  memoId,
  botId,
  onMemoNavigate,
  theme,
}: {
  memoId: string
  botId: string
  onMemoNavigate?: (memoId: string) => void
  theme: any
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
    <View style={[memStyles.container, { borderTopColor: theme.border }]}>
      <TouchableOpacity
        onPress={() => setOpen(v => !v)}
        activeOpacity={0.7}
        style={memStyles.trigger}
      >
        {hasMemos && (
          <Text style={[memStyles.triggerText, { color: theme.textSecondary }]}>
            参考了你 {context.retrievedMemos.length} 条以前的记录
          </Text>
        )}
      </TouchableOpacity>

      {open && hasMemos && (
        <View style={memStyles.memoList}>
          {context.retrievedMemos.map(memo => (
            <TouchableOpacity
              key={memo.id}
              onPress={() => onMemoNavigate?.(memo.id)}
              activeOpacity={0.7}
              style={[memStyles.memoRow, { borderRadius: theme.radius.small }]}
            >
              <FileText size={13} color={theme.textTertiary} />
              <Text style={[memStyles.memoExcerpt, { color: theme.text }]} numberOfLines={1}>
                {memo.excerpt}
              </Text>
              <Text style={[memStyles.memoDate, { color: theme.textTertiary }]}>
                {dayjs(memo.createdAt).format('M月D日')}
              </Text>
              <ArrowRight size={11} color={theme.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

function ThinkingPanel({ content, theme }: { content?: string; theme: any }) {
  const [expanded, setExpanded] = useState(false)
  if (!content) return null
  return (
    <View style={[styles.thinkingContainer, { backgroundColor: theme.surfaceMuted }]}>
      <TouchableOpacity
        onPress={() => setExpanded(v => !v)}
        style={styles.thinkingHeader}
        activeOpacity={0.7}
        accessibilityLabel="展开/折叠心路历程"
      >
        <Lightbulb size={14} color={theme.textSecondary} />
        <Text style={[styles.thinkingTitle, { color: theme.textSecondary }]}>心路历程</Text>
        {expanded ? (
          <ChevronUp size={14} color={theme.textSecondary} style={{ marginLeft: 'auto' }} />
        ) : (
          <ChevronDown size={14} color={theme.textSecondary} style={{ marginLeft: 'auto' }} />
        )}
      </TouchableOpacity>
      {expanded && (
        <View accessibilityRole="text" accessibilityLabel="心路历程内容">
          <Text style={[styles.thinkingContent, { color: theme.textSecondary }]}>{content}</Text>
        </View>
      )}
    </View>
  )
}

export function BotReplyCard({
  reply,
  onReply,
  onMemoNavigate,
  isThread = false,
}: BotReplyCardProps) {
  const { theme } = useThemeStore()
  const threadCount = Math.max(reply.threadCount - 1, 0)
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({})

  useEffect(() => {
    void getBearerAuthHeaders().then(setAuthHeaders)
  }, [])

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
                    source={{ uri: reply.bot.avatarUrl, headers: authHeaders }}
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
            <ThinkingPanel content={reply.thinkingContent} theme={theme} />
            {!isThread && (
              <MemoryContextPanel
                memoId={reply.memoId}
                botId={reply.bot.id}
                onMemoNavigate={onMemoNavigate}
                theme={theme}
              />
            )}
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
  thinkingContainer: {
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 8,
  },
  thinkingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 36,
  },
  thinkingTitle: {
    fontSize: 13,
  },
  thinkingContent: {
    fontSize: 13,
    lineHeight: 19.5,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
})

const memStyles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    marginTop: 4,
  },
  trigger: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 2,
  },
  triggerText: {
    fontSize: 12,
    lineHeight: 18,
  },
  memoList: {
    marginTop: 6,
    gap: 2,
  },
  memoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  memoExcerpt: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  memoDate: {
    fontSize: 11,
    flexShrink: 0,
  },
})
