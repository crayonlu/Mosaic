import { MemoListSkeleton } from '@/components/ui'
import { useInfiniteMemos, useMemosByDate } from '@/lib/query'
import { useThemeStore } from '@/stores/themeStore'
import type { MemoWithResources } from '@mosaic/api'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { MemoCard } from '../memo/MemoCard'

const FeedMemoCard = React.memo(function FeedMemoCard({
  memo,
  onPress,
  isSelected,
}: {
  memo: MemoWithResources
  onPress: (memo: MemoWithResources) => void
  isSelected: boolean
}) {
  const handlePress = useCallback(() => onPress(memo), [memo, onPress])
  return <MemoCard memo={memo} onPress={handlePress} isSelected={isSelected} />
})

interface MemoFeedProps {
  targetDate?: string
  onMemoPress?: (memo: MemoWithResources) => void
  onMemoDelete?: (id: string) => void
  headerComponent?: React.ReactNode
  isSelectionMode?: boolean
  selectedIds?: string[]
  onSelectionChange?: (id: string) => void
  onMemosChange?: (memos: MemoWithResources[]) => void
}

export function MemoFeed({
  targetDate,
  onMemoPress,
  onMemoDelete,
  headerComponent,
  isSelectionMode = false,
  selectedIds = [],
  onSelectionChange,
  onMemosChange,
}: MemoFeedProps) {
  const { theme } = useThemeStore()
  const [refreshing, setRefreshing] = useState(false)

  const {
    data: memosByDate,
    isLoading: loadingByDate,
    refetch: refetchByDate,
  } = useMemosByDate(targetDate || '', { archived: false })

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

  useEffect(() => {
    onMemosChange?.(memos)
  }, [memos, onMemosChange])

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

  const handleSelectionChange = useCallback(
    (id: string) => {
      onSelectionChange?.(id)
    },
    [onSelectionChange]
  )

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const handleCardPress = useCallback(
    (memo: MemoWithResources) => {
      if (isSelectionMode) {
        handleSelectionChange(memo.id)
      } else {
        onMemoPress?.(memo)
      }
    },
    [isSelectionMode, handleSelectionChange, onMemoPress]
  )

  const renderMemoCard = useCallback(
    ({ item }: { item: MemoWithResources }) => (
      <FeedMemoCard
        memo={item}
        onPress={handleCardPress}
        isSelected={isSelectionMode && selectedSet.has(item.id)}
      />
    ),
    [handleCardPress, isSelectionMode, selectedSet]
  )

  const renderEmptyState = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          {targetDate ? '今天还没有记录' : '暂无Memo'}
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
          {targetDate ? '点击下方按钮创建你的第一条Memo' : '开始记录你的想法和灵感'}
        </Text>
      </View>
    ),
    [targetDate, theme.text, theme.textSecondary]
  )

  const renderFooter = useMemo(() => {
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
  }, [isFetchingNextPage, hasMore, memos.length, theme.primary, theme.textSecondary])

  if (isLoading) {
    return (
      <View>
        {headerComponent}
        <MemoListSkeleton count={6} />
      </View>
    )
  }

  if (memos.length === 0) {
    return renderEmptyState
  }

  return (
    <FlatList
      data={memos}
      renderItem={renderMemoCard}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.listContent}
      maxToRenderPerBatch={10}
      removeClippedSubviews={true}
      updateCellsBatchingPeriod={50}
      windowSize={10}
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
      ListHeaderComponent={headerComponent as React.ReactElement | null}
      showsVerticalScrollIndicator={false}
    />
  )
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 10,
    paddingHorizontal: 0,
  },
  cardContent: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 72,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
  },
})
