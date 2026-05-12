import { MemoRevisionPage } from '@/components/memo/MemoRevisionPage'
import { toast } from '@/components/ui/Toast'
import { useDeleteRevision, useMemo, useRevisions } from '@/lib/query/hooks/useMemos'
import { useDeleteMemo } from '@/lib/query/mutations/memoMutations'
import { useThemeStore } from '@/stores/themeStore'
import type { MemoWithResources } from '@mosaic/api'
import { router, useLocalSearchParams, useNavigation } from 'expo-router'
import { ArrowLeft, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react-native'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo as useRNMemo,
  useState,
} from 'react'
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import PagerView from 'react-native-pager-view'

export default function MemoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { theme } = useThemeStore()
  const navigation = useNavigation()
  const pagerRef = useRef<PagerView>(null)
  const hasInitializedRef = useRef(false)

  const { data: memo, isLoading: memoLoading } = useMemo(id ?? '')
  const { data: revisions = [] } = useRevisions(id ?? '')
  const { mutateAsync: deleteMemo } = useDeleteMemo()
  const { mutateAsync: deleteRevision } = useDeleteRevision()

  const pages = useRNMemo(() => {
    return [...revisions].sort((a, b) => a.revisionNumber - b.revisionNumber)
  }, [revisions])

  const totalPages = pages.length > 0 ? pages.length : 1
  const latestPageIndex = totalPages - 1

  const [currentPage, setCurrentPage] = useState(latestPageIndex)

  useEffect(() => {
    // Only jump to latest on first load, not on subsequent refetches
    // (e.g. after a revision is deleted, we don't want to force-jump the user)
    if (pages.length > 0 && !hasInitializedRef.current) {
      hasInitializedRef.current = true
      const idx = pages.length - 1
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

  const handleDelete = useCallback(() => {
    if (!memo) return
    const canDeleteRevision = pages.length > 1 && !isOnLatest

    const doDeleteRevision = async () => {
      const rev = pages[currentPage]
      if (!rev) return
      try {
        await deleteRevision({ memoId: memo.id, revisionId: rev.id })
        toast.show({ type: 'success', title: '已删除该版本' })
      } catch {
        toast.show({ type: 'error', title: '删除失败' })
      }
    }

    const doDeleteMemo = async () => {
      try {
        await deleteMemo(memo.id)
        toast.show({ type: 'success', title: '已删除' })
        router.back()
      } catch {
        toast.show({ type: 'error', title: '删除失败' })
      }
    }

    if (canDeleteRevision) {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['取消', '删除此版本', '删除整个记录'],
            destructiveButtonIndex: [1, 2],
            cancelButtonIndex: 0,
          },
          buttonIdx => {
            if (buttonIdx === 1) doDeleteRevision()
            else if (buttonIdx === 2) doDeleteMemo()
          }
        )
      } else {
        Alert.alert('删除', '请选择删除方式', [
          { text: '取消', style: 'cancel' },
          { text: '删除此版本', style: 'destructive', onPress: doDeleteRevision },
          { text: '删除整个记录', style: 'destructive', onPress: doDeleteMemo },
        ])
      }
    } else {
      Alert.alert('删除记录', '确定要删除这条记录吗？', [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: doDeleteMemo },
      ])
    }
  }, [memo, pages, currentPage, isOnLatest, deleteRevision, deleteMemo])

  const handleEdit = useCallback(() => {
    if (!memo) return
    router.push(`/modal?memoId=${memo.id}`)
  }, [memo])

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTransparent: false,
      headerStyle: { backgroundColor: theme.background },
      headerShadowVisible: false,
      headerLeft: () => (
        <Pressable
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.headerBtn}
        >
          <ArrowLeft size={22} color={theme.text} strokeWidth={2} />
        </Pressable>
      ),
      headerTitle: () =>
        totalPages > 1 ? (
          <View style={styles.headerTitle}>
            <Pressable
              onPress={goToPrev}
              disabled={currentPage === 0}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
            >
              <ChevronRight
                size={20}
                color={currentPage === totalPages - 1 ? theme.textSecondary : theme.text}
                strokeWidth={2}
              />
            </Pressable>
          </View>
        ) : null,
      headerRight: () => (
        <View style={styles.headerRight}>
          {isOnLatest && (
            <Pressable
              onPress={handleEdit}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.headerBtn}
            >
              <Pencil size={18} color={theme.text} strokeWidth={2} />
            </Pressable>
          )}
          <Pressable
            onPress={handleDelete}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.headerBtn}
          >
            <Trash2 size={18} color={theme.textSecondary} strokeWidth={2} />
          </Pressable>
        </View>
      ),
    })
  }, [
    navigation,
    theme,
    currentPage,
    totalPages,
    isOnLatest,
    goToPrev,
    goToNext,
    handleEdit,
    handleDelete,
  ])

  if (memoLoading || !memo) {
    return <View style={[styles.container, { backgroundColor: theme.background }]} />
  }

  if (pages.length <= 1) {
    const rev = pages[0] ?? null
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <MemoRevisionPage
          memo={memo as MemoWithResources}
          revision={rev}
          isLatest
          onBotReply={() => {}}
        />
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
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
                onBotReply={() => {}}
              />
            </View>
          )
        })}
      </PagerView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  headerBtn: {
    padding: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerPageLabel: {
    fontSize: 14,
  },
})
