import { MemoCard } from '@/components/memo/MemoCard'
import { MemoListSkeleton } from '@/components/ui'
import { useMemo as useMemoQuery } from '@/lib/query'
import { useThemeStore } from '@/stores/themeStore'
import type { Memo } from '@mosaic/api'
import { FileX, Search } from 'lucide-react-native'
import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'

const SearchMemoCard = React.memo(function SearchMemoCard({
  item: initialItem,
  onPress,
  onDelete,
  semanticEnabled,
}: {
  item: Memo
  onPress: (memo: Memo) => void
  onDelete?: (id: string) => void
  semanticEnabled: boolean
}) {
  // Read from normalized cache so search results share refs with other lists
  const { data: cachedItem } = useMemoQuery(initialItem.id)
  const item = (cachedItem ?? initialItem) as Memo
  const handlePress = useCallback(() => onPress(item), [item, onPress])
  return (
    <MemoCard
      memo={item}
      onPress={handlePress}
      onDelete={onDelete}
      showSemanticBadge={
        semanticEnabled && (item.matchType === 'semantic' || item.matchType === 'hybrid')
      }
    />
  )
})

interface SearchResultsProps {
  results: Memo[]
  loading: boolean
  hasMore: boolean
  onLoadMore: () => void
  onRefresh: () => void
  refreshing: boolean
  onMemoPress: (memo: Memo) => void
  onMemoArchive?: (id: string) => void
  onMemoDelete?: (id: string) => void
  emptyQuery?: boolean
  semanticEnabled?: boolean
}

export function SearchResults({
  results,
  loading,
  hasMore,
  onLoadMore,
  onRefresh,
  refreshing,
  onMemoPress,
  onMemoArchive,
  onMemoDelete,
  emptyQuery = false,
  semanticEnabled = false,
}: SearchResultsProps) {
  const { theme } = useThemeStore()
  const { t } = useTranslation()

  const renderItem = useCallback(
    ({ item }: { item: Memo }) => (
      <SearchMemoCard
        item={item}
        onPress={onMemoPress}
        onDelete={onMemoDelete}
        semanticEnabled={semanticEnabled}
      />
    ),
    [onMemoPress, onMemoDelete, semanticEnabled]
  )

  const renderEmptyState = useMemo(() => {
    if (emptyQuery) {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon]}>
            <Search size={48} color={theme.primary} strokeWidth={1.5} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>{t('search.startSearch')}</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            {t('search.startSearchHint')}
          </Text>
        </View>
      )
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIcon]}>
          <FileX size={48} color={theme.primary} strokeWidth={1.5} />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>{t('search.noResults')}</Text>
        <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
          {t('search.noResultsHint')}
        </Text>
      </View>
    )
  }, [t, emptyQuery, theme.primary, theme.text, theme.textSecondary])

  const renderFooter = useMemo(() => {
    if (!hasMore && results.length > 0) {
      return (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            {t('search.resultsCount', { count: results.length })}
          </Text>
        </View>
      )
    }

    if (refreshing) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      )
    }

    return null
  }, [t, hasMore, results.length, refreshing, theme.textSecondary, theme.primary])

  if (loading && results.length === 0) {
    return <MemoListSkeleton count={6} />
  }

  if (results.length === 0) {
    return renderEmptyState
  }

  return (
    <FlatList
      data={results}
      renderItem={renderItem}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.listContent}
      maxToRenderPerBatch={8}
      initialNumToRender={8}
      windowSize={7}
      removeClippedSubviews={true}
      updateCellsBatchingPeriod={50}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      }
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.3}
      ListFooterComponent={renderFooter}
      showsVerticalScrollIndicator={false}
    />
  )
}

const styles = StyleSheet.create({
  listContent: {
    paddingVertical: 8,
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
    fontWeight: '500',
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
