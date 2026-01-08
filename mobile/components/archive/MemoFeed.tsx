import { useThemeStore } from '@/stores/theme-store'
import { useDatabaseStore } from '@/lib/database/state-manager'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native'
import { memoService } from '@/lib/services/memo-service'
import { stringUtils } from '@/lib/utils/string'
import { ResourceGallery } from './ResourceGallery'
import { Badge, Loading } from '@/components/ui'
import { Archive, Trash2, MoreVertical } from 'lucide-react-native'
import type { MemoWithResources } from '@/types/memo'

interface MemoFeedProps {
  targetDate?: string
  onMemoPress?: (memo: MemoWithResources) => void
  onMemoArchive?: (id: string) => void
  onMemoDelete?: (id: string) => void
}

export function MemoFeed({ targetDate, onMemoPress, onMemoArchive, onMemoDelete }: MemoFeedProps) {
  const { theme } = useThemeStore()
  const { isReady: dbReady, isInitializing: dbInitializing, error: dbError } = useDatabaseStore()
  const [memos, setMemos] = useState<MemoWithResources[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const flatListRef = useRef<FlatList>(null)

  // Load memos
  const loadMemos = useCallback(
    async (loadMore = false) => {
      if (!dbReady) return

      try {
        if (!loadMore) {
          setLoading(true)
        } else {
          setLoadingMore(true)
        }

        let loadedMemos: MemoWithResources[]

        if (targetDate) {
          // Load by date
          loadedMemos = await memoService.getMemosByDate(targetDate)
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
        setLoadingMore(false)
      }
    },
    [targetDate, page, memos, dbReady]
  )

  // Initial load
  useEffect(() => {
    if (dbReady) {
      loadMemos()
    }
  }, [dbReady])

  // Pull to refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    setPage(1)
    loadMemos()
  }, [loadMemos])

  // Load more when scrolling to bottom
  const handleLoadMore = useCallback(() => {
    if (!loading && !refreshing && !loadingMore && hasMore && !targetDate) {
      setPage(prev => prev + 1)
      loadMemos(true)
    }
  }, [loading, refreshing, loadingMore, hasMore, targetDate, loadMemos])

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

  // Extract plain text from HTML for preview
  const getPreviewText = (content: string): string => {
    const plainText = stringUtils.extractTextFromHtml(content)
    return plainText.length > 200 ? plainText.substring(0, 200) + '...' : plainText
  }

  // Format timestamp
  const formatTimestamp = (timestamp: number): string => {
    return stringUtils.formatRelativeTime(timestamp)
  }

  // Render memo card
  const renderMemoCard = ({ item }: { item: MemoWithResources }) => {
    const previewText = getPreviewText(item.content)
    const hasResources = item.resources.length > 0

    return (
      <TouchableOpacity
        onPress={() => onMemoPress?.(item)}
        activeOpacity={0.8}
        style={[
          styles.memoCard,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.memoHeader}>
          <View style={styles.userInfo}>
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <Text style={styles.avatarText}>M</Text>
            </View>
            <View style={styles.userMeta}>
              <Text style={[styles.userName, { color: theme.text }]}>Mosaic</Text>
              <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
                {formatTimestamp(item.createdAt)}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.moreButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MoreVertical size={20} color={theme.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {previewText && (
          <Text style={[styles.memoContent, { color: theme.text }]}>{previewText}</Text>
        )}

        {/* Resources */}
        {hasResources && (
          <ResourceGallery
            memo={item}
            onImagePress={index => {
              // Handle image press
              console.log('Image pressed:', index)
            }}
          />
        )}

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {item.tags.slice(0, 3).map(tag => (
              <Badge key={tag} text={tag} variant="outline" size="small" />
            ))}
            {item.tags.length > 3 && (
              <Text style={[styles.moreTags, { color: theme.textSecondary }]}>
                +{item.tags.length - 3}
              </Text>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={[styles.actionsContainer, { borderTopColor: theme.border }]}>
          <TouchableOpacity
            onPress={() => handleArchive(item.id)}
            style={styles.actionButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Archive size={18} color={theme.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(item.id)}
            style={styles.actionButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 size={18} color={theme.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    )
  }

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        {targetDate ? '今天还没有记录' : '暂无Memo'}
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        {targetDate ? '点击下方按钮创建你的第一条Memo' : '开始记录你的想法和灵感'}
      </Text>
    </View>
  )

  // Render list footer
  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      )
    }

    if (!hasMore) {
      return (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>没有更多了</Text>
        </View>
      )
    }

    return null
  }

  if (dbInitializing || loading) {
    return <Loading text="加载中..." fullScreen />
  }

  if (dbError) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>数据库错误</Text>
        <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>{dbError}</Text>
      </View>
    )
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
  memoCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  memoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  userMeta: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 12,
  },
  moreButton: {
    padding: 8,
  },
  memoContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    fontSize: 15,
    lineHeight: 22,
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 6,
  },
  moreTags: {
    fontSize: 12,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 16,
  },
  actionButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
  },
})
