import { Loading } from '@/components/ui'
import { memosApi } from '@/lib/api'
import { useThemeStore } from '@/stores/theme-store'
import type { MemoWithResources } from '@/types/memo'
import { Check } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
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
  headerComponent,
  isSelectionMode = false,
  selectedIds = [],
  onSelectionChange,
}: MemoFeedProps) {
  const { theme } = useThemeStore()
  const [memos, setMemos] = useState<MemoWithResources[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const flatListRef = useRef<FlatList>(null)

  const loadMemos = useCallback(
    async (loadMore = false) => {
      try {
        if (!loadMore) {
          setLoading(true)
        } else {
          setLoadingMore(true)
        }

        let loadedMemos: MemoWithResources[]

        if (targetDate) {
          loadedMemos = await memosApi.getByDate(targetDate)
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
        setLoadingMore(false)
      }
    },
    [targetDate, page, memos]
  )

  useEffect(() => {
    loadMemos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    setPage(1)
    loadMemos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLoadMore = useCallback(() => {
    if (!loading && !refreshing && !loadingMore && hasMore && !targetDate) {
      setPage(prev => prev + 1)
      loadMemos(true)
    }
  }, [loading, refreshing, loadingMore, hasMore, targetDate, loadMemos])

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
      style={({ pressed }) => [
        styles.cardContainer,
      ]}
    >
      <View style={styles.cardContent}>
        <MemoCard
          memo={item}
          onPress={() => {
            if (!isSelectionMode) {
              onMemoPress?.(item)
            }
          }}
          onDelete={() => handleDelete(item.id)}
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
        <Text style={{ fontSize: 32 }}>📝</Text>
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
    if (loadingMore) {
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

  if (loading) {
    return <Loading text="加载中..." fullScreen />
  }

  if (memos.length === 0) {
    return renderEmptyState()
  }

  return (
    <FlatList
      ref={flatListRef}
      data={memos}
      renderItem={renderMemoCard}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={headerComponent ? () => headerComponent : undefined}
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
