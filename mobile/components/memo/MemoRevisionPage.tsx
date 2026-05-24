import { BotReplyList } from '@/components/bot/BotReplyList'
import { MarkdownRenderer } from '@/components/editor/MarkdownRenderer'
import { EditableAISummary } from '@/components/memo/EditableAISummary'
import { DraggableImageGrid } from '@/components/ui'
import type { MediaGridItem } from '@/components/ui/DraggableImageGrid'
import { useAuthHeaders } from '@/hooks/useAuthHeaders'
import i18n from '@/lib/i18n'
import { stringUtils } from '@/lib/utils/string'
import { useThemeStore } from '@/stores/themeStore'
import type { BotReply, MemoRevision, MemoWithResources } from '@mosaic/api'
import { resourcesApi } from '@mosaic/api'
import { router } from 'expo-router'
import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { Easing, FadeIn } from 'react-native-reanimated'

interface MemoRevisionPageProps {
  memo: MemoWithResources
  revision: MemoRevision | null
  isLatest: boolean
  botReplies?: BotReply[]
  onBotReply: (reply: BotReply) => void
  onSaveAISummary?: (text: string) => Promise<void>
}

export function MemoRevisionPage({
  memo,
  revision,
  isLatest,
  botReplies,
  onBotReply,
  onSaveAISummary,
}: MemoRevisionPageProps) {
  const { theme } = useThemeStore()
  const { headers: authHeaders } = useAuthHeaders()

  const content = isLatest ? memo.content : (revision?.content ?? '')
  const tags = isLatest ? memo.tags : (revision?.tags ?? [])
  const aiSummary = isLatest ? memo.aiSummary : revision?.aiSummary
  const timestamp = isLatest ? memo.updatedAt : (revision?.createdAt ?? memo.createdAt)
  const isFirstRevision = revision?.revisionNumber === 1

  const timeLabel = isFirstRevision
    ? i18n.t('memoRevision.createdAt', { time: stringUtils.formatDateTime(timestamp) })
    : i18n.t('memoRevision.updatedAt', { time: stringUtils.formatDateTime(timestamp) })

  const mediaItems: MediaGridItem[] = useMemo(
    () =>
      (memo.resources ?? []).map(r => ({
        key: r.id,
        uri: resourcesApi.getDownloadUrl(r.id),
        type: r.resourceType,
        thumbnailUri: r.resourceType === 'video' ? resourcesApi.getThumbnailUrl(r.id) : undefined,
      })),
    [memo.resources]
  )

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.contentContainer}
      scrollEnabled
      nestedScrollEnabled
      showsVerticalScrollIndicator
      alwaysBounceVertical
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.revisionBar}>
        <Text style={[styles.revisionTime, { color: theme.textSecondary }]}>{timeLabel}</Text>
        {!isLatest && revision && (
          <View style={[styles.revisionBadge, { backgroundColor: theme.surfaceMuted }]}>
            <Text style={[styles.revisionBadgeText, { color: theme.textSecondary }]}>
              {i18n.t('memoRevision.revisionNumber', { n: revision.revisionNumber })}
            </Text>
          </View>
        )}
      </View>

      {aiSummary && isLatest && onSaveAISummary ? (
        <EditableAISummary summary={aiSummary} onSave={onSaveAISummary} />
      ) : aiSummary ? (
        <Animated.View
          entering={FadeIn.duration(200).easing(Easing.out(Easing.cubic))}
          style={[
            styles.aiSummaryContainer,
            {
              backgroundColor: theme.surfaceMuted,
              borderRadius: theme.radius.medium,
            },
          ]}
        >
          <Text style={[styles.aiSummaryTitle, { color: theme.text }]}>
            {i18n.t('memoRevision.aiSummary')}
          </Text>
          <MarkdownRenderer content={aiSummary} />
        </Animated.View>
      ) : null}

      <View style={styles.contentPad}>
        <MarkdownRenderer content={content} />
      </View>

      {mediaItems.length > 0 && (
        <View style={styles.resourcesContainer}>
          <DraggableImageGrid items={mediaItems} authHeaders={authHeaders} draggable={false} />
        </View>
      )}

      <View style={styles.tagsContainer}>
        {tags.length > 0 ? (
          tags.map((tag, i) => (
            <View key={tag} style={[styles.tag, { backgroundColor: theme.surfaceMuted }]}>
              <Text style={[styles.tagText, { color: theme.textSecondary }]}>#{tag}</Text>
            </View>
          ))
        ) : (
          <Text style={[styles.tagText, { color: theme.textTertiary }]}>
            {i18n.t('memoRevision.noTags')}
          </Text>
        )}
      </View>

      {isLatest && botReplies && (
        <BotReplyList
          replies={botReplies}
          revisionNumber={revision?.revisionNumber}
          onReply={onBotReply}
          onMemoNavigate={id => router.push(`/memo/${id}`)}
        />
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 20,
  },
  aiSummaryContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
  },
  aiSummaryTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  contentPad: {
    padding: 16,
  },
  resourcesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 13,
  },
  revisionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 2,
  },
  revisionTime: {
    fontSize: 12,
  },
  revisionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  revisionBadgeText: {
    fontSize: 12,
  },
})
