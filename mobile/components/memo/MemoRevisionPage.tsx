import { BotReplyList } from '@/components/bot/BotReplyList'
import { MarkdownRenderer } from '@/components/editor/MarkdownRenderer'
import { DraggableImageGrid } from '@/components/ui'
import type { MediaGridItem } from '@/components/ui/DraggableImageGrid'
import { getBearerAuthHeaders } from '@/lib/services/apiAuth'
import { stringUtils } from '@/lib/utils/string'
import { useThemeStore } from '@/stores/themeStore'
import type { BotReply, MemoRevision, MemoWithResources } from '@mosaic/api'
import { resourcesApi } from '@mosaic/api'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

interface MemoRevisionPageProps {
  memo: MemoWithResources
  revision: MemoRevision | null
  isLatest: boolean
  onBotReply: (reply: BotReply) => void
}

export function MemoRevisionPage({ memo, revision, isLatest, onBotReply }: MemoRevisionPageProps) {
  const { theme } = useThemeStore()
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({})

  useEffect(() => {
    getBearerAuthHeaders().then(setAuthHeaders)
  }, [])

  const content = isLatest ? memo.content : (revision?.content ?? '')
  const tags = isLatest ? memo.tags : (revision?.tags ?? [])
  const aiSummary = isLatest ? memo.aiSummary : revision?.aiSummary
  const timestamp = isLatest ? memo.updatedAt : (revision?.createdAt ?? memo.createdAt)
  const isFirstRevision = revision?.revisionNumber === 1

  const timeLabel = isFirstRevision
    ? `创建于 ${stringUtils.formatDateTime(timestamp)}`
    : `更新于 ${stringUtils.formatDateTime(timestamp)}`

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
              第 {revision.revisionNumber} 版
            </Text>
          </View>
        )}
      </View>

      {aiSummary && (
        <View
          style={[
            styles.aiSummaryContainer,
            {
              backgroundColor: theme.surfaceMuted,
              borderRadius: theme.radius.medium,
            },
          ]}
        >
          <Text style={[styles.aiSummaryTitle, { color: theme.text }]}>AI 摘要</Text>
          <Text style={[styles.aiSummaryText, { color: theme.textSecondary }]}>{aiSummary}</Text>
        </View>
      )}

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
            <View key={i} style={[styles.tag, { backgroundColor: theme.surfaceMuted }]}>
              <Text style={[styles.tagText, { color: theme.textSecondary }]}>#{tag}</Text>
            </View>
          ))
        ) : (
          <Text style={[styles.tagText, { color: theme.textTertiary }]}>暂无标签</Text>
        )}
      </View>

      {isLatest && (
        <BotReplyList
          memoId={memo.id}
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
  aiSummaryText: {
    fontSize: 14,
    lineHeight: 20,
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
