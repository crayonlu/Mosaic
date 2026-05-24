import { ExpandablePanel } from '@/components/ui/ExpandablePanel'
import i18n from '@/lib/i18n'
import { useMemoryContext } from '@/lib/query'
import { stringUtils } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import type { BotReply } from '@mosaic/api'
import dayjs from 'dayjs'
import { Image } from 'expo-image'
import { ArrowRight, ChevronDown, ChevronUp, FileText, Lightbulb } from 'lucide-react-native'
import { useCallback, useRef, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

interface BotReplyCardProps {
  reply: BotReply
  onReply: (reply: BotReply) => void
  onMemoNavigate?: (memoId: string) => void
  isThread?: boolean
  authHeaders?: Record<string, string>
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
  const [open, setOpen] = useState(false)
  const hasOpenedRef = useRef(false)

  // Only fetch reference records when user clicks the trigger
  const { data: context, isLoading } = useMemoryContext(memoId, botId, {
    enabled: hasOpenedRef.current,
  })

  const hasMemos = (context?.retrievedMemos.length ?? 0) > 0

  const handleToggle = useCallback(() => {
    if (isLoading) return
    if (!hasOpenedRef.current) {
      hasOpenedRef.current = true
      setOpen(true)
      return
    }
    setOpen(prev => !prev)
  }, [isLoading])

  // After fetch completed with empty results — show message instead of panel
  const showEmptyMessage = hasOpenedRef.current && !isLoading && context && !hasMemos

  return (
    <View style={[memStyles.container, { borderTopColor: theme.border }]}>
      <TouchableOpacity onPress={handleToggle} activeOpacity={0.7} style={memStyles.trigger}>
        <Text style={[memStyles.triggerText, { color: theme.textSecondary }]}>
          {!hasOpenedRef.current
            ? i18n.t('botReply.viewReference')
            : isLoading || !context
              ? i18n.t('botReply.loadingReference')
              : showEmptyMessage
                ? i18n.t('botReply.noReference')
                : i18n.t('botReply.referenced', { n: context.retrievedMemos.length })}
        </Text>
      </TouchableOpacity>

      {hasOpenedRef.current && hasMemos && (
        <ExpandablePanel expanded={open} maxHeight={160}>
          <View style={memStyles.memoList}>
            {context!.retrievedMemos.map(memo => (
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
                  {dayjs(memo.createdAt).format(i18n.t('botReply.dateFormat'))}
                </Text>
                <ArrowRight size={11} color={theme.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        </ExpandablePanel>
      )}
    </View>
  )
}

function ThinkingPanel({ content, theme }: { content?: string; theme: any }) {
  const [expanded, setExpanded] = useState(false)
  const hasOpenedRef = useRef(false)

  const handleToggle = useCallback(() => {
    if (!hasOpenedRef.current) {
      hasOpenedRef.current = true
      setExpanded(true)
      return
    }
    setExpanded(v => !v)
  }, [])

  if (!content) return null
  return (
    <View style={[styles.thinkingContainer, { backgroundColor: theme.surfaceMuted }]}>
      <TouchableOpacity
        onPress={handleToggle}
        style={styles.thinkingHeader}
        activeOpacity={0.7}
        accessibilityLabel={i18n.t('botReply.toggleThinking')}
      >
        <Lightbulb size={14} color={theme.textSecondary} />
        <Text style={[styles.thinkingTitle, { color: theme.textSecondary }]}>
          {i18n.t('botReply.thinkingTitle')}
        </Text>
        {hasOpenedRef.current && expanded ? (
          <ChevronUp size={14} color={theme.textSecondary} style={{ marginLeft: 'auto' }} />
        ) : (
          <ChevronDown size={14} color={theme.textSecondary} style={{ marginLeft: 'auto' }} />
        )}
      </TouchableOpacity>
      {hasOpenedRef.current && (
        <ExpandablePanel expanded={expanded} maxHeight={240}>
          <Text style={[styles.thinkingContent, { color: theme.textSecondary }]}>{content}</Text>
        </ExpandablePanel>
      )}
    </View>
  )
}

export function BotReplyCard({
  reply,
  onReply,
  onMemoNavigate,
  isThread = false,
  authHeaders = {},
}: BotReplyCardProps) {
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
        <View
          style={[
            styles.bubble,
            { backgroundColor: theme.surface, borderRadius: theme.radius.medium },
          ]}
        >
          <TouchableOpacity onPress={() => onReply(reply)} activeOpacity={0.85}>
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
                <Text style={[styles.replyBtn, { color: theme.textSecondary }]}>
                  {i18n.t('botReply.continueChat')}
                </Text>
              )}
            </View>
            <Text style={[styles.content, { color: theme.text }]}>{reply.content}</Text>
          </TouchableOpacity>
          <ThinkingPanel content={reply.thinkingContent} theme={theme} />
          {!isThread && (
            <MemoryContextPanel
              memoId={reply.memoId}
              botId={reply.bot.id}
              onMemoNavigate={onMemoNavigate}
              theme={theme}
            />
          )}
        </View>
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
    width: '100%',
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
    paddingRight: 8,
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
