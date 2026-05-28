import { BrandLoader } from '@/components/ui'
import { useInfiniteMemos, useMemo as useMemoQuery, useMemos, useMemosByDate } from '@/lib/query'
import { useThemeStore } from '@/stores/themeStore'
import type { MemoWithResources } from '@mosaic/api'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { MemoCard } from '../memo/MemoCard'

const FeedMemoCard = React.memo(function FeedMemoCard({
  memo: initialMemo,
  onPress,
  isSelected,
}: {
  memo: MemoWithResources
  onPress: (memo: MemoWithResources) => void
  isSelected: boolean
}) {
  // Read from normalized cache so all pages share the same object reference
  const { data: cachedMemo } = useMemoQuery(initialMemo.id)
  const memo = cachedMemo ?? initialMemo
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
  const { t } = useTranslation()
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

  // Detect if empty state is due to all memos being archived
  const { data: archivedAll } = useMemos({ archived: true, pageSize: 1 })
  const { data: archivedForDate } = useMemosByDate(targetDate || '', { archived: true })
  const hasArchivedMemos = targetDate
    ? (archivedForDate?.length ?? 0) > 0
    : (archivedAll?.total ?? 0) > 0

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
      <View style={[styles.emptyContainer]}>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          {hasArchivedMemos
            ? targetDate
              ? t('memoFeed.emptyTodayArchived')
              : t('memoFeed.emptyArchived')
            : targetDate
              ? t('memoFeed.emptyToday')
              : t('memoFeed.empty')}
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
          {hasArchivedMemos
            ? targetDate
              ? t('memoFeed.emptyTodayArchivedHint')
              : t('memoFeed.emptyArchivedHint')
            : targetDate
              ? t('memoFeed.emptyTodayHint')
              : t('memoFeed.emptyHint')}
        </Text>
      </View>
    ),
    [targetDate, theme.text, theme.textSecondary, hasArchivedMemos, t]
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
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            {t('common.noMore')}
          </Text>
        </View>
      )
    }

    return null
  }, [isFetchingNextPage, hasMore, memos.length, theme.primary, theme.textSecondary, t])

  if (isLoading) {
    return (
      <View style={{ flex: 1 }}>
        {headerComponent}
        <BrandLoader loading />
      </View>
    )
  }

  if (memos.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        {headerComponent}
        {renderEmptyState}
      </View>
    )
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
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
