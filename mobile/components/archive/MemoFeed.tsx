import { Badge, Loading } from '@/components/ui'
import { useDatabaseStore } from '@/lib/database/state-manager'
import { memoService } from '@/lib/services/memo-service'
import { stringUtils } from '@/lib/utils/string'
import { useThemeStore } from '@/stores/theme-store'
import type { MemoWithResources } from '@/types/memo'
import { MoreVertical, Trash2 } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { ResourceGallery } from './ResourceGallery'

interface MemoFeedProps {
  targetDate?: string
  onMemoPress?: (memo: MemoWithResources) => void
  onMemoArchive?: (id: string) => void
  onMemoDelete?: (id: string) => void
  headerComponent?: React.ReactNode
}

export function MemoFeed({
  targetDate,
  onMemoPress,
  onMemoArchive,
  onMemoDelete,
  headerComponent,
}: MemoFeedProps) {
  const { theme } = useThemeStore()
  const { isReady: dbReady, isInitializing: dbInitializing, error: dbError } = useDatabaseStore()
  const [memos, setMemos] = useState<MemoWithResources[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
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
  }, [dbReady, loadMemos])

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
            onPress={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MoreVertical size={20} color={theme.textSecondary} strokeWidth={2} />
          </TouchableOpacity>

          {activeMenuId === item.id && (
            <View
              style={[
                styles.menuBubble,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  shadowColor: '#000',
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  handleDelete(item.id)
                  setActiveMenuId(null)
                }}
                style={styles.menuItem}
              >
                <Trash2 size={16} color="#EF4444" />
                <Text style={[styles.menuText, { color: '#EF4444' }]}>删除</Text>
              </TouchableOpacity>
            </View>
          )}
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
  memoCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
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
  menuBubble: {
    position: 'absolute',
    top: 10,
    right: 48,
    width: 120,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 4,
    zIndex: 100,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  menuDivider: {
    height: 1,
    marginHorizontal: 8,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '500',
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
