import { MemoCard } from '@/components/memo/MemoCard'
import { Loading } from '@/components/ui'
import { useThemeStore } from '@/stores/theme-store'
import type { MemoWithResources } from '@/types/memo'
import { FileX, Search } from 'lucide-react-native'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'

interface SearchResultsProps {
  results: MemoWithResources[]
  loading: boolean
  hasMore: boolean
  onLoadMore: () => void
  onRefresh: () => void
  refreshing: boolean
  onMemoPress: (memo: MemoWithResources) => void
  onMemoArchive?: (id: string) => void
  onMemoDelete?: (id: string) => void
  emptyQuery?: boolean
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
}: SearchResultsProps) {
  const { theme } = useThemeStore()

  const renderEmptyState = () => {
    if (emptyQuery) {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: `${theme.primary}10` }]}>
            <Search size={48} color={theme.primary} strokeWidth={1.5} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>开始搜索</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            输入关键词或选择筛选条件开始搜索
          </Text>
        </View>
      )
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIcon, { backgroundColor: `${theme.primary}10` }]}>
          <FileX size={48} color={theme.primary} strokeWidth={1.5} />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>暂无搜索结果</Text>
        <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
          尝试调整搜索条件或关键词
        </Text>
      </View>
    )
  }

  const renderFooter = () => {
    if (!hasMore) {
      return (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            共 {results.length} 条结果
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

  if (loading && results.length === 0) {
    return <Loading text="搜索中..." fullScreen />
  }

  if (results.length === 0) {
    return renderEmptyState()
  }

  return (
    <FlatList
      data={results}
      renderItem={({ item }) => (
        <MemoCard
          memo={item}
          onPress={() => onMemoPress(item)}
          onDelete={onMemoDelete}
        />
      )}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.listContent}
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
