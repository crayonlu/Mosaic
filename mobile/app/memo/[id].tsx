import { FullScreenEditor } from '@/components/editor/FullScreenEditor'
import { MarkdownRenderer } from '@/components/editor/MarkdownRenderer'
import { DraggableImageGrid, Loading, toast } from '@/components/ui'
import type { MediaGridItem } from '@/components/ui/DraggableImageGrid'
import { useConnection } from '@/hooks/useConnection'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { useDeleteMemo, useMemo as useQueryMemo, useUpdateMemo } from '@/lib/query'
import { getBearerAuthHeaders } from '@/lib/services/apiAuth'
import { stringUtils } from '@/lib/utils'
import { useCacheStore } from '@/stores/cacheStore'
import { useThemeStore } from '@/stores/themeStore'
import { resourcesApi, type ResourceResponse } from '@mosaic/api'
import { router, useLocalSearchParams } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export default function MemoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { theme } = useThemeStore()
  const { canUseNetwork } = useConnection()
  const handleError = useErrorHandler()
  const { data: memo, isLoading } = useQueryMemo(id || '')
  const { mutateAsync: updateMemo, isPending: isUpdating } = useUpdateMemo()
  const { mutateAsync: deleteMemo, isPending: isDeleting } = useDeleteMemo()
  const { isReady: isCacheReady } = useCacheStore()

  const [isEditorVisible, setIsEditorVisible] = useState(false)
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({})

  const isPending = isUpdating || isDeleting

  useEffect(() => {
    const loadAuthHeaders = async () => {
      const headers = await getBearerAuthHeaders()
      setAuthHeaders(headers)
    }

    loadAuthHeaders()
  }, [])

  const toMediaItem = useCallback(
    (resource: ResourceResponse): MediaGridItem => ({
      key: resource.id,
      uri: resourcesApi.getDownloadUrl(resource.id),
      type: resource.resourceType,
      thumbnailUri:
        resource.resourceType === 'video' ? resourcesApi.getThumbnailUrl(resource.id) : undefined,
    }),
    []
  )

  const memoMediaItems = useMemo(
    () => (memo?.resources ?? []).map(toMediaItem),
    [memo?.resources, toMediaItem]
  )

  const handleEditSubmit = useCallback(
    async (content: string, tags: string[], resourceIds: string[], aiSummary?: string) => {
      if (!memo || !canUseNetwork || isPending) return

      try {
        const existingResourceIds = memo.resources.map(resource => resource.id)
        const removedResourceIds = existingResourceIds.filter(id => !resourceIds.includes(id))

        await updateMemo({
          id: memo.id,
          data: {
            content: content.trim(),
            tags,
            resourceIds,
            aiSummary,
          },
        })

        for (const resourceId of removedResourceIds) {
          try {
            await resourcesApi.delete(resourceId)
          } catch {
            // Best-effort cleanup: memo update has succeeded even if resource delete fails.
          }
        }

        setIsEditorVisible(false)
        toast.success('成功', '已更新')
      } catch (error) {
        handleError(error)
        toast.error('错误', '更新失败')
      }
    },
    [memo, canUseNetwork, isPending, updateMemo, handleError]
  )

  const handleDelete = useCallback(() => {
    if (!memo) return

    toast.show({
      type: 'warning',
      title: '确认删除',
      message: '确定要删除这条Memo吗？此操作无法撤销。',
      actionLabel: '删除',
      onAction: async () => {
        try {
          await deleteMemo(memo.id)
          toast.success('成功', 'Memo已删除')
          router.back()
        } catch (error) {
          handleError(error)
          toast.error('错误', '删除失败')
        }
      },
    })
  }, [memo, deleteMemo, handleError])

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Loading text="加载中..." fullScreen />
      </View>
    )
  }

  if (!memo) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.text }]}>Memo不存在</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={router.back} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setIsEditorVisible(true)}
            disabled={isPending}
            style={[styles.headerAction, { opacity: isPending ? theme.state.disabledOpacity : 1 }]}
          >
            <Text style={[styles.headerActionText, { color: theme.textSecondary }]}>编辑</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            disabled={isPending}
            style={[styles.headerAction, { opacity: isPending ? theme.state.disabledOpacity : 1 }]}
          >
            <Text style={[styles.headerActionText, { color: theme.textSecondary }]}>删除</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {memo.aiSummary && (
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
            <Text style={[styles.aiSummaryText, { color: theme.textSecondary }]}>
              {memo.aiSummary}
            </Text>
          </View>
        )}

        <View style={{ padding: 16 }}>
          <MarkdownRenderer content={memo.content} />
        </View>
        {memo.resources.length > 0 && (
          <View style={styles.resourcesContainer}>
            <DraggableImageGrid
              items={memoMediaItems}
              authHeaders={authHeaders}
              draggable={false}
              isCacheLoading={!isCacheReady}
            />
          </View>
        )}

        {memo.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {memo.tags.map((tag, index) => (
              <View key={index} style={[styles.tag, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.tagText, { color: theme.textSecondary }]}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.metadata}>
          <View
            style={[
              styles.metadataChip,
              {
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.metadataLabel, { color: theme.textSecondary }]}>创建</Text>
            <Text style={[styles.metadataValue, { color: theme.textSecondary }]}>
              {stringUtils.formatDateTime(memo.createdAt)}
            </Text>
          </View>
          {memo.updatedAt > memo.createdAt && (
            <View
              style={[
                styles.metadataChip,
                {
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.metadataLabel, { color: theme.textSecondary }]}>更新</Text>
              <Text style={[styles.metadataValue, { color: theme.textSecondary }]}>
                {stringUtils.formatDateTime(memo.updatedAt)}
              </Text>
            </View>
          )}
        </View>
      </View>

      <FullScreenEditor
        visible={isEditorVisible}
        title="编辑 Memo"
        submitLabel="保存"
        initialContent={memo.content}
        initialTags={memo.tags}
        initialAISummary={memo.aiSummary || undefined}
        initialMediaItems={memoMediaItems}
        initialResourceIds={memo.resources.map(resource => resource.id)}
        uploadMemoId={memo.id}
        onClose={() => setIsEditorVisible(false)}
        onSubmit={handleEditSubmit}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 14,
  },
  headerAction: {
    height: 32,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingTop: 8,
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
  resourcesContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metadataLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  metadataValue: {
    fontSize: 12,
  },
})
