import { Loading } from '@/components/ui'
import { memosApi } from '@/lib/api'
import { stringUtils } from '@/lib/utils/string'
import { useThemeStore } from '@/stores/theme-store'
import { type MemoWithResources } from '@/types/memo'
import { FileX } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { MemoCard } from './MemoCard'

interface MemoListProps {
  date?: string
  onMemoPress: (memo: MemoWithResources) => void
  onMemoArchive?: (id: string) => void
  onMemoDelete?: (id: string) => void
  refreshTrigger?: number
  headerComponent?: React.ComponentType<any> | React.ReactElement | null | undefined
}

export function MemoList({
  date,
  onMemoPress,
  onMemoArchive,
  onMemoDelete,
  refreshTrigger,
  headerComponent,
}: MemoListProps) {
  const { theme } = useThemeStore()
  const [memos, setMemos] = useState<MemoWithResources[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const flatListRef = useRef<FlatList>(null)

  const loadMemos = useCallback(
    async (loadMore = false) => {
      try {
        if (!loadMore) {
          setLoading(true)
        }

        let loadedMemos: MemoWithResources[]

        if (date) {
          loadedMemos = await memosApi.getByDate(date)
          setHasMore(false)
        } else {
          const currentPage = loadMore ? page : 1
          const response = await memosApi.list({
            page: currentPage,
            pageSize: 20,
            archived: false,
          })

          if (loadMore) {
            loadedMemos = [...memos, ...response.items]
          } else {
            loadedMemos = response.items
            setPage(1)
          }

          setHasMore(response.page < response.totalPages)
        }

        setMemos(loadedMemos)
      } catch (error) {
        console.error('Failed to load memos:', error)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [date, page, memos]
  )

  useEffect(() => {
    loadMemos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  useEffect(() => {
    if (refreshTrigger !== undefined) {
      loadMemos()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    setPage(1)
    loadMemos()
  }, [loadMemos])

  const handleLoadMore = useCallback(() => {
    if (!loading && !refreshing && hasMore && !date) {
      setPage(prev => prev + 1)
      loadMemos(true)
    }
  }, [loading, refreshing, hasMore, date, loadMemos])

  const handleArchive = useCallback(
    async (id: string) => {
      try {
        await memosApi.archive(id)
        await loadMemos()
        onMemoArchive?.(id)
      } catch (error) {
        console.error('Failed to archive memo:', error)
      }
    },
    [loadMemos, onMemoArchive]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await memosApi.delete(id)
        await loadMemos()
        onMemoDelete?.(id)
      } catch (error) {
        console.error('Failed to delete memo:', error)
      }
    },
    [loadMemos, onMemoDelete]
  )

  const groupedMemos = useMemo(() => {
    const groups: Record<
      string,
      { date: string; displayDate: string; memos: MemoWithResources[] }
    > = {}

    if (date) {
      const displayDate = stringUtils.formatDate(date)
      groups[date] = {
        date,
        displayDate: date === stringUtils.getTodayDateString() ? '今天' : displayDate,
        memos,
      }
    } else {
      memos.forEach(memo => {
        const memoDate = stringUtils.getDateStringFromTimestamp(memo.createdAt)
        const today = stringUtils.getTodayDateString()

        let displayDate: string
        if (memoDate === today) {
          displayDate = '今天'
        } else if (memoDate === stringUtils.getYesterdayDateString()) {
          displayDate = '昨天'
        } else {
          displayDate = stringUtils.formatDate(memoDate)
        }

        if (!groups[memoDate]) {
          groups[memoDate] = {
            date: memoDate,
            displayDate,
            memos: [],
          }
        }

        groups[memoDate].memos.push(memo)
      })
    }

    return Object.entries(groups)
      .map(([, group]) => group)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [memos, date])

  const renderDateHeader = (displayDate: string, count: number, isFirst: boolean) => (
    <View
      style={[
        styles.dateHeader,
        { borderTopColor: theme.border },
        isFirst && { borderTopWidth: 0, marginTop: 0 },
      ]}
    >
      <Text style={[styles.dateHeaderText, { color: theme.text }]}>{displayDate}</Text>
      {count > 0 && (
        <Text style={[styles.dateHeaderCount, { color: theme.textSecondary }]}>{count} 条Memo</Text>
      )}
    </View>
  )

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: `${theme.primary}10` }]}>
        <FileX size={48} color={theme.primary} strokeWidth={1.5} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        {date ? '今天还没有记录' : '暂无Memo'}
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        {date ? '点击下方按钮创建你的第一条Memo' : '开始记录你的想法和灵感'}
      </Text>
    </View>
  )

  const renderGroup = ({
    item: group,
    index,
  }: {
    item: { date: string; displayDate: string; memos: MemoWithResources[] }
    index: number
  }) => (
    <View key={group.date}>
      {renderDateHeader(group.displayDate, group.memos.length, index === 0)}
      {group.memos.map(memo => (
        <MemoCard
          key={memo.id}
          memo={memo}
          onPress={() => onMemoPress(memo)}
          onDelete={handleDelete}
        />
      ))}
    </View>
  )

  const renderFooter = () => {
    if (!hasMore) {
      return (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>没有更多了</Text>
        </View>
      )
    }

    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={theme.primary} />
      </View>
    )
  }

  if (loading) {
    return <Loading text="加载中..." fullScreen />
  }

  if (memos.length === 0) {
    return renderEmptyState()
  }

  return (
    <FlatList
      ref={flatListRef}
      data={groupedMemos}
      renderItem={renderGroup}
      keyExtractor={item => item.date}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={headerComponent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      }
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.3}
      ListFooterComponent={renderFooter}
      showsVerticalScrollIndicator={false}
    />
  )
}

const styles = StyleSheet.create({
  listContent: {},
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 8,
    borderTopWidth: 1,
  },
  dateHeaderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateHeaderCount: {
    fontSize: 12,
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    opacity: 0.7,
  },
})
