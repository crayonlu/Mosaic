import { BotThreadSheet } from '@/components/bot/BotThreadSheet'
import { FullScreenEditor } from '@/components/editor/FullScreenEditor'
import { MemoRevisionPage } from '@/components/memo/MemoRevisionPage'
import { HeaderActionMenu, ScreenHeader } from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import { useToastConfirm } from '@/hooks/useToastConfirm'
import { useDeleteRevision, useMemoDetail } from '@/lib/query/hooks/useMemos'
import { useDeleteMemo, useUpdateMemo } from '@/lib/query/mutations/memoMutations'
import { useThemeStore } from '@/stores/themeStore'
import {
  resourcesApi,
  type BotReply,
  type MemoWithResources,
  type UpdateMemoRequest,
} from '@mosaic/api'
import { router, useLocalSearchParams } from 'expo-router'
import { ChevronLeft, ChevronRight, MoreVertical, Pencil, Trash2 } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useMemo as useRNMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import PagerView from 'react-native-pager-view'

function arraysEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

export default function MemoDetailScreen() {
  const { t } = useTranslation()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { theme } = useThemeStore()
  const pagerRef = useRef<PagerView>(null)
  const hasInitializedRef = useRef(false)
  const saveJumpRef = useRef(false)

  const { confirm } = useToastConfirm()

  // Single consolidated query — returns memo + revisions + botReplies in one request
  const { data: detail, isLoading: detailLoading } = useMemoDetail(id ?? '')
  const { mutateAsync: deleteMemo } = useDeleteMemo()
  const { mutateAsync: deleteRevision } = useDeleteRevision()
  const { mutateAsync: updateMemo } = useUpdateMemo()
  const [showEditor, setShowEditor] = useState(false)
  const [botReply, setBotReply] = useState<BotReply | null>(null)
  const [threadVisible, setThreadVisible] = useState(false)

  const memo = detail?.memo as MemoWithResources | undefined
  const revisions = detail?.revisions ?? []
  const botReplies = detail?.botReplies ?? []

  const pages = useRNMemo(() => {
    return [...revisions].sort((a, b) => a.revisionNumber - b.revisionNumber)
  }, [revisions])

  const totalPages = pages.length > 0 ? pages.length : 1
  const latestPageIndex = totalPages - 1

  const [currentPage, setCurrentPage] = useState(latestPageIndex)

  useEffect(() => {
    if (pages.length === 0) return

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      const idx = pages.length - 1
      console.log('[MemoDetail] first load, jumping to page', idx + 1, '/', pages.length)
      setCurrentPage(idx)
      pagerRef.current?.setPageWithoutAnimation(idx)
      return
    }

    if (saveJumpRef.current) {
      saveJumpRef.current = false
      const idx = pages.length - 1
      console.log('[MemoDetail] save detected, jumping to page', idx + 1, '/', pages.length)
      setCurrentPage(idx)
      pagerRef.current?.setPageWithoutAnimation(idx)
    }
  }, [pages.length])

  const isOnLatest = currentPage === latestPageIndex

  const goToPrev = useCallback(() => {
    if (currentPage > 0) {
      pagerRef.current?.setPage(currentPage - 1)
    }
  }, [currentPage])

  const goToNext = useCallback(() => {
    if (currentPage < totalPages - 1) {
      pagerRef.current?.setPage(currentPage + 1)
    }
  }, [currentPage, totalPages])

  const handleDeleteRevision = useCallback(() => {
    if (!memo) return
    const rev = pages[currentPage]
    if (!rev) return
    confirm(t('memo.versionDeleteConfirm'), async () => {
      try {
        await deleteRevision({ memoId: memo.id, revisionId: rev.id })
        toast.show({ type: 'success', title: t('memo.versionDeleted') })
      } catch {
        toast.show({ type: 'error', title: t('memo.versionDeleteFailed') })
      }
    })
  }, [t, memo, pages, currentPage, deleteRevision, confirm])

  const handleDeleteMemo = useCallback(() => {
    if (!memo) return
    confirm(t('memo.deleteConfirm'), async () => {
      try {
        await deleteMemo(memo.id)
        router.back()
      } catch {
        toast.show({ type: 'error', title: t('memo.deleteFailed') })
      }
    })
  }, [t, memo, deleteMemo, confirm])

  const handleEdit = useCallback(() => {
    if (!memo) return
    setShowEditor(true)
  }, [memo])

  const handleTagPress = useCallback((tag: string) => {
    router.push({ pathname: '/search', params: { tag } })
  }, [])

  const handleBotReply = useCallback((reply: BotReply) => {
    setBotReply(reply)
    setThreadVisible(true)
  }, [])

  const handleSaveAISummary = useCallback(
    async (text: string) => {
      if (!memo) return
      try {
        await updateMemo({ id: memo.id, data: { aiSummary: text || null } })
      } catch {
        toast.show({ type: 'error', title: t('memo.saveFailed') })
      }
    },
    [t, memo, updateMemo]
  )

  const renderHeader = () => (
    <ScreenHeader
      showBack
      center={
        totalPages > 1 ? (
          <View style={styles.pageNav}>
            <Pressable
              onPress={goToPrev}
              disabled={currentPage === 0}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel={t('components.screenHeader.back')}
            >
              <ChevronLeft
                size={20}
                color={currentPage === 0 ? theme.textSecondary : theme.text}
                strokeWidth={2}
              />
            </Pressable>
            <Text style={[styles.headerPageLabel, { color: theme.textSecondary }]}>
              {currentPage + 1} / {totalPages}
            </Text>
            <Pressable
              onPress={goToNext}
              disabled={currentPage === totalPages - 1}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel={t('components.screenHeader.back')}
            >
              <ChevronRight
                size={20}
                color={currentPage === totalPages - 1 ? theme.textSecondary : theme.text}
                strokeWidth={2}
              />
            </Pressable>
          </View>
        ) : undefined
      }
      right={
        <View style={styles.headerRight}>
          {isOnLatest ? (
            <HeaderActionMenu
              accessibilityLabel={t('memo.moreActions')}
              trigger={<MoreVertical size={20} color={theme.text} strokeWidth={2} />}
              items={[
                {
                  label: t('memo.editMemo'),
                  icon: <Pencil size={16} color={theme.text} strokeWidth={2} />,
                  onPress: handleEdit,
                },
                {
                  label: t('common.delete'),
                  icon: <Trash2 size={16} color={theme.error} strokeWidth={2} />,
                  destructive: true,
                  onPress: handleDeleteMemo,
                },
              ]}
            />
          ) : (
            <Pressable
              onPress={handleDeleteRevision}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ padding: 4 }}
              accessibilityLabel={t('common.delete')}
            >
              <Trash2 size={18} color={theme.text} strokeWidth={2} />
            </Pressable>
          )}
        </View>
      }
    />
  )

  if (detailLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {renderHeader()}
        <View style={[styles.content, styles.centered]}>
          <ActivityIndicator size="large" color={theme.textSecondary} />
        </View>
      </View>
    )
  }

  if (!memo) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {renderHeader()}
        <View style={[styles.content, styles.centered]}>
          <Text style={[styles.notFoundText, { color: theme.textSecondary }]}>
            {t('memo.notFound')}
          </Text>
        </View>
      </View>
    )
  }

  if (pages.length <= 1) {
    const rev = pages[0] ?? null
    const validResources = (memo.resources ?? []).filter(r => r.resourceType)
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {showEditor && (
          <FullScreenEditor
            visible
            title={t('memo.editMemo')}
            submitLabel={t('memo.save')}
            placeholder={t('memo.editContent')}
            initialContent={memo.content ?? ''}
            initialTags={Array.isArray(memo.tags) ? memo.tags : []}
            initialAISummary={memo.aiSummary ?? undefined}
            initialMediaItems={validResources.map(r => ({
              key: r.id,
              uri: resourcesApi.getDownloadUrl(r.id),
              thumbnailUri:
                r.resourceType === 'video' ? resourcesApi.getThumbnailUrl(r.id) : undefined,
              type: r.resourceType as 'image' | 'video',
            }))}
            initialResourceIds={validResources.map(r => r.id)}
            uploadMemoId={memo.id}
            onClose={() => setShowEditor(false)}
            onSubmit={async (content, tags, resources, aiSummary) => {
              const data: UpdateMemoRequest = {}
              if (content !== (memo.content ?? '')) data.content = content
              if (!arraysEqual(tags, Array.isArray(memo.tags) ? memo.tags : [])) data.tags = tags
              if (
                !arraysEqual(
                  resources,
                  validResources.map(r => r.id)
                )
              )
                data.resourceIds = resources
              if (aiSummary !== (memo.aiSummary ?? undefined)) data.aiSummary = aiSummary ?? null
              if (Object.keys(data).length > 0) {
                console.log('[MemoDetail] saving changes:', data)
                await updateMemo({ id: memo.id, data })
                saveJumpRef.current = true
              }
              setShowEditor(false)
            }}
          />
        )}
        {renderHeader()}
        <MemoRevisionPage
          memo={memo as MemoWithResources}
          revision={rev}
          isLatest
          botReplies={botReplies}
          onBotReply={handleBotReply}
          onSaveAISummary={handleSaveAISummary}
          onTagPress={handleTagPress}
        />
        <BotThreadSheet
          visible={threadVisible}
          reply={botReply}
          onClose={() => setThreadVisible(false)}
        />
      </View>
    )
  }

  const validResources = (memo.resources ?? []).filter(r => r.resourceType)
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {showEditor && (
        <FullScreenEditor
          visible
          title={t('memo.editMemo')}
          submitLabel={t('memo.save')}
          placeholder={t('memo.editContent')}
          initialContent={memo.content ?? ''}
          initialTags={Array.isArray(memo.tags) ? memo.tags : []}
          initialAISummary={memo.aiSummary ?? undefined}
          initialMediaItems={validResources.map(r => ({
            key: r.id,
            uri: resourcesApi.getDownloadUrl(r.id),
            thumbnailUri:
              r.resourceType === 'video' ? resourcesApi.getThumbnailUrl(r.id) : undefined,
            type: r.resourceType as 'image' | 'video',
          }))}
          initialResourceIds={validResources.map(r => r.id)}
          uploadMemoId={memo.id}
          onClose={() => setShowEditor(false)}
          onSubmit={async (content, tags, resources, aiSummary) => {
            const data: UpdateMemoRequest = {}
            if (content !== (memo.content ?? '')) data.content = content
            if (!arraysEqual(tags, Array.isArray(memo.tags) ? memo.tags : [])) data.tags = tags
            if (
              !arraysEqual(
                resources,
                validResources.map(r => r.id)
              )
            )
              data.resourceIds = resources
            if (aiSummary !== (memo.aiSummary ?? undefined)) data.aiSummary = aiSummary ?? null
            if (Object.keys(data).length > 0) {
              await updateMemo({ id: memo.id, data })
              saveJumpRef.current = true
            }
            setShowEditor(false)
          }}
        />
      )}
      {renderHeader()}
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={latestPageIndex}
        onPageSelected={e => setCurrentPage(e.nativeEvent.position)}
        scrollEnabled
      >
        {pages.map((rev, idx) => {
          const isLatest = idx === latestPageIndex
          return (
            <View key={rev.id} style={styles.page}>
              <MemoRevisionPage
                memo={memo as MemoWithResources}
                revision={rev}
                isLatest={isLatest}
                botReplies={isLatest ? botReplies : []}
                onBotReply={handleBotReply}
                onSaveAISummary={isLatest ? handleSaveAISummary : undefined}
                onTagPress={handleTagPress}
              />
            </View>
          )
        })}
      </PagerView>
      <BotThreadSheet
        visible={threadVisible}
        reply={botReply}
        onClose={() => setThreadVisible(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pageNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  content: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerPageLabel: {
    fontSize: 14,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    fontSize: 15,
  },
})
