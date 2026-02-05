import { Loading } from '@/components/ui'
import { useInfiniteMemos, useMemosByDate } from '@/lib/query'
import { useThemeStore } from '@/stores/theme-store'
import type { MemoWithResources } from '@/types/memo'
import { Check, FileX } from 'lucide-react-native'
import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { MemoCard } from '../memo/MemoCard'

interface MemoFeedProps {
  targetDate?: string
  onMemoPress?: (memo: MemoWithResources) => void
  onMemoDelete?: (id: string) => void
  headerComponent?: React.ReactNode
  isSelectionMode?: boolean
  selectedIds?: string[]
  onSelectionChange?: (id: string) => void
}

export function MemoFeed({
  targetDate,
  onMemoPress,
  onMemoDelete,
  isSelectionMode = false,
  selectedIds = [],
  onSelectionChange,
}: MemoFeedProps) {
  const { theme } = useThemeStore()
  const [refreshing, setRefreshing] = useState(false)

  const {
    data: memosByDate,
    isLoading: loadingByDate,
    refetch: refetchByDate,
  } = useMemosByDate(targetDate || '')

  const {
    data: paginatedData,
    isLoading: loadingList,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch: refetchList,
  } = useInfiniteMemos({ pageSize: 20, archived: false })

  const memos = useMemo(() => {
    if (targetDate) {
      return memosByDate || []
    }
    return paginatedData?.pages.flatMap(page => page.items) || []
  }, [targetDate, memosByDate, paginatedData])

  const isLoading = targetDate ? loadingByDate : loadingList
  const hasMore = targetDate ? false : hasNextPage

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    if (targetDate) {
      await refetchByDate()
    } else {
      await refetchList()
    }
    setRefreshing(false)
  }, [targetDate, refetchByDate, refetchList])

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore && !targetDate) {
      fetchNextPage()
    }
  }, [isLoading, hasMore, targetDate, fetchNextPage])

  const handleSelectionChange = (id: string) => {
    onSelectionChange?.(id)
  }

  const isSelected = (id: string) => selectedIds.includes(id)

  const renderMemoCard = ({ item }: { item: MemoWithResources }) => (
    <Pressable
      onPress={() => {
        if (isSelectionMode) {
          handleSelectionChange(item.id)
        } else {
          onMemoPress?.(item)
        }
      }}
      style={({ pressed }) => [styles.cardContainer]}
    >
      <View style={styles.cardContent}>
        <MemoCard
          memo={item}
          onPress={() => {
            if (!isSelectionMode) {
              onMemoPress?.(item)
            }
          }}
        />
      </View>
      {isSelectionMode && (
        <View style={[styles.checkbox, isSelected(item.id) && { backgroundColor: theme.primary }]}>
          {isSelected(item.id) && <Check size={14} color="#FFFFFF" />}
        </View>
      )}
    </Pressable>
  )

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: `${theme.primary}10` }]}>
        <FileX size={48} color={theme.primary} strokeWidth={1.5} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        {targetDate ? '今天还没有记录' : '暂无Memo'}
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        {targetDate ? '点击下方按钮创建你的第一条Memo' : '开始记录你的想法和灵感'}
      </Text>
    </View>
  )

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      )
    }

    if (!hasMore && memos.length > 0) {
      return (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>没有更多了</Text>
        </View>
      )
    }

    return null
  }

  if (isLoading) {
    return <Loading text="加载中..." fullScreen />
  }

  if (memos.length === 0) {
    return renderEmptyState()
  }

  return (
    <FlatList
      data={memos}
      renderItem={renderMemoCard}
      keyExtractor={item => item.id}
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
  listContent: {},
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    marginHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
})
