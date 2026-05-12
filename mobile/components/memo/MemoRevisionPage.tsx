import { BotReplyList } from '@/components/bot/BotReplyList'
import { MarkdownRenderer } from '@/components/editor/MarkdownRenderer'
import { DraggableImageGrid } from '@/components/ui'
import type { MediaGridItem } from '@/components/ui/DraggableImageGrid'
import { getBearerAuthHeaders } from '@/lib/services/apiAuth'
import { stringUtils } from '@/lib/utils/string'
import { useThemeStore } from '@/stores/themeStore'
import type { BotReply, MemoRevision } from '@mosaic/api'
import { resourcesApi, type MemoWithResources } from '@mosaic/api'
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
      isLatest
        ? (memo.resources ?? []).map(r => ({
            key: r.id,
            uri: resourcesApi.getDownloadUrl(r.id),
            type: r.resourceType,
            thumbnailUri:
              r.resourceType === 'video' ? resourcesApi.getThumbnailUrl(r.id) : undefined,
          }))
        : [],
    [isLatest, memo.resources]
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

      {tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {tags.map((tag, i) => (
            <View key={i} style={[styles.tag, { backgroundColor: theme.surfaceMuted }]}>
              <Text style={[styles.tagText, { color: theme.textSecondary }]}>#{tag}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.metadata}>
        <View
          style={[
            styles.metadataChip,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.metadataValue, { color: theme.textSecondary }]}>{timeLabel}</Text>
        </View>
        {!isLatest && revision && (
          <View
            style={[
              styles.metadataChip,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.metadataValue, { color: theme.textSecondary }]}>
              第 {revision.revisionNumber} 版
            </Text>
          </View>
        )}
      </View>

      {isLatest && (
        <BotReplyList
          memoId={memo.id}
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
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
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
  metadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
  },
  metadataChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metadataValue: {
    fontSize: 12,
  },
})
