import { useThemeStore } from '@/stores/theme-store'
import { RefreshCw, FileX } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { type MemoWithResources } from '@/types/memo'
import { memoService } from '@/lib/services/memo-service'
import { dateUtils } from '@/lib/utils/date'
import { MemoCard } from './MemoCard'
import { stringUtils } from '@/lib/utils/string'

interface MemoListProps {
  date?: string
  onMemoPress: (memo: MemoWithResources) => void
  onMemoArchive?: (id: string) => void
  onMemoDelete?: (id: string) => void
  refreshTrigger?: number
}

export function MemoList({
  date,
  onMemoPress,
  onMemoArchive,
  onMemoDelete,
  refreshTrigger,
}: MemoListProps) {
  const { theme } = useThemeStore()
  const [memos, setMemos] = useState<MemoWithResources[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const flatListRef = useRef<FlatList>(null)

  // Load memos
  const loadMemos = useCallback(async (loadMore = false) => {
    try {
      if (!loadMore) {
        setLoading(true)
      }

      let loadedMemos: MemoWithResources[]

      if (date) {
        // Load by date
        loadedMemos = await memoService.getMemosByDate(date)
      } else {
        // Load paginated
        const currentPage = loadMore ? page : 1
        const newMemos = await memoService.listMemos({
          page: currentPage,
          pageSize: 20,
          isArchived: false,
          isDeleted: false,
        })

        if (loadMore) {
          loadedMemos = [...memos, ...newMemos]
        } else {
          loadedMemos = newMemos
          setPage(1)
        }

        // Check if there are more items
        setHasMore(newMemos.length === 20)
      }

      setMemos(loadedMemos)
    } catch (error) {
      console.error('Failed to load memos:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [date, page, memos])

  // Initial load
  useEffect(() => {
    loadMemos()
  }, [date])

  // Refresh when trigger changes
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      loadMemos()
    }
  }, [refreshTrigger])

  // Pull to refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    setPage(1)
    loadMemos()
  }, [loadMemos])

  // Load more when scrolling to bottom
  const handleLoadMore = useCallback(() => {
    if (!loading && !refreshing && hasMore && !date) {
      setPage(prev => prev + 1)
      loadMemos(true)
    }
  }, [loading, refreshing, hasMore, date, loadMemos])

  // Handle memo actions
  const handleArchive = useCallback(
    async (id: string) => {
      try {
        await memoService.archiveMemo(id, true)
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
        await memoService.deleteMemo(id)
        await loadMemos()
        onMemoDelete?.(id)
      } catch (error) {
        console.error('Failed to delete memo:', error)
      }
    },
    [loadMemos, onMemoDelete]
  )

  // Group memos by date
  const groupedMemos = useMemo(() => {
    const groups: Record<
      string,
      { date: string; displayDate: string; memos: MemoWithResources[] }
    > = {}

    // If date is specified, use it as the group
    if (date) {
      const displayDate = stringUtils.formatDate(date)
      groups[date] = {
        date,
        displayDate: date === stringUtils.getTodayDateString() ? '今天' : displayDate,
        memos,
      }
    } else {
      // Group by date
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
      .map(([date, group]) => group)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [memos, date])

  // Render date header
  const renderDateHeader = (displayDate: string, count: number) => (
    <View style={[styles.dateHeader, { borderTopColor: theme.border }]}>
      <Text style={[styles.dateHeaderText, { color: theme.text }]}>
        {displayDate}
      </Text>
      {count > 0 && (
        <Text style={[styles.dateHeaderCount, { color: theme.textSecondary }]}>
          {count} 条Memo
        </Text>
      )}
    </View>
  )

  // Render loading skeleton
  const renderSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {[...Array(3)].map((_, i) => (
        <View
          key={i}
          style={[
            styles.skeletonCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={styles.skeletonImage} />
          <View style={styles.skeletonContent}>
            <View
              style={[styles.skeletonLine, { backgroundColor: theme.border }]}
            />
            <View
              style={[styles.skeletonLine, { backgroundColor: theme.border }]}
            />
            <View
              style={[styles.skeletonLine, { backgroundColor: theme.border }]}
            />
          </View>
        </View>
      ))}
    </View>
  )

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View
        style={[
          styles.emptyIcon,
          { backgroundColor: `${theme.primary}10` },
        ]}
      >
        <FileX size={48} color={theme.primary} strokeWidth={1.5} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        {date ? '今天还没有记录' : '暂无Memo'}
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        {date
          ? '点击下方按钮创建你的第一条Memo'
          : '开始记录你的想法和灵感'}
      </Text>
    </View>
  )

  // Render a single date group
  const renderGroup = ({ item: group }: { item: { date: string; displayDate: string; memos: MemoWithResources[] } }) => (
    <View key={group.date}>
      {renderDateHeader(group.displayDate, group.memos.length)}
      {group.memos.map(memo => (
        <MemoCard
          key={memo.id}
          memo={memo}
          onPress={() => onMemoPress(memo)}
          onArchive={handleArchive}
          onDelete={handleDelete}
        />
      ))}
    </View>
  )

  // Render list footer
  const renderFooter = () => {
    if (!hasMore) {
      return (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            没有更多了
          </Text>
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
    return renderSkeleton()
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
  listContent: {
    padding: 16,
  },
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
  skeletonContainer: {
    padding: 16,
  },
  skeletonCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    minHeight: 80,
    overflow: 'hidden',
  },
  skeletonImage: {
    width: 100,
    height: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  skeletonContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-around',
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    width: '80%',
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
