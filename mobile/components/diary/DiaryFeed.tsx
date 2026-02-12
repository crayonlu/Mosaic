import { Loading } from '@/components/ui'
import { resourcesApi } from '@/lib/api/resources'
import { useDiaries } from '@/lib/query'
import { getMoodColor, getMoodEmoji } from '@/lib/utils/mood'
import { stringUtils } from '@/lib/utils/string'
import { useThemeStore } from '@/stores/theme-store'
import type { DiaryResponse } from '@/types/api'
import { Image } from 'expo-image'
import { ChevronRight, FileX } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'

interface DiaryFeedProps {
  onDiaryPress?: (diary: DiaryResponse) => void
}

export function DiaryFeed({ onDiaryPress }: DiaryFeedProps) {
  const { theme } = useThemeStore()
  const [refreshing, setRefreshing] = useState(false)
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({})

  // Load auth headers on mount
  useEffect(() => {
    const loadAuthHeaders = async () => {
      const headers = await resourcesApi.getAuthHeaders()
      setAuthHeaders(headers)
    }
    loadAuthHeaders()
  }, [])

  const getResourceUrl = (resourceId: string): string => {
    return resourcesApi.getDirectDownloadUrl(resourceId)
  }

  const {
    data: paginatedData,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useDiaries({ pageSize: 20 })

  const diaries = useMemo(() => {
    return paginatedData?.pages.flatMap(page => page.items) || []
  }, [paginatedData])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasNextPage) {
      fetchNextPage()
    }
  }, [isLoading, hasNextPage, fetchNextPage])

  const renderDiaryCard = ({ item }: { item: DiaryResponse; index: number }) => {
    const moodColor = getMoodColor(item.moodKey)

    return (
      <Pressable
        onPress={() => onDiaryPress?.(item)}
        style={() => [
          styles.diaryCard,
          {
            backgroundColor: theme.background,
            borderColor: theme.border,
          },
        ]}
      >
        {item.coverImageId && (
          <View style={styles.coverContainer}>
            <Image 
              source={{ 
                uri: getResourceUrl(item.coverImageId),
                headers: authHeaders
              }} 
              style={styles.coverImage} 
              contentFit="cover" 
            />
            <View style={[styles.coverOverlay, { backgroundColor: `${moodColor}10` }]} />
          </View>
        )}

        <View style={styles.cardHeader}>
          <View style={[styles.moodBadge, { backgroundColor: `${moodColor}20` }]}>
            <Text style={styles.moodEmoji}>{getMoodEmoji(item.moodKey)}</Text>
          </View>
          <Text style={[styles.date, { color: theme.text }]}>
            {stringUtils.formatDate(item.date)}
          </Text>
        </View>

        <Text
          style={[styles.summary, { color: theme.textSecondary }]}
          numberOfLines={4}
          ellipsizeMode="tail"
        >
          {item.summary || '今天还没有记录...'}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={[styles.viewMore, { color: theme.primary }]}>查看详情</Text>
          <ChevronRight size={14} color={theme.primary} strokeWidth={2} />
        </View>
      </Pressable>
    )
  }

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: `${theme.primary}10` }]}>
        <FileX size={48} color={theme.primary} strokeWidth={1.5} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>暂无日记</Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        开始记录你的每日心情和生活点滴
      </Text>
    </View>
  )

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>加载更多...</Text>
        </View>
      )
    }

    if (!hasNextPage && diaries.length > 0) {
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

  if (diaries.length === 0) {
    return renderEmptyState()
  }

  return (
    <FlatList
      data={diaries}
      renderItem={renderDiaryCard}
      keyExtractor={item => item.date}
      numColumns={2}
      columnWrapperStyle={styles.columnWrapper}
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
    paddingTop: 8,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    gap: 12,
  },
  diaryCard: {
    flex: 1,
    marginBottom: 12,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  coverContainer: {
    position: 'relative',
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    height: 100,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  moodBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodEmoji: {
    fontSize: 20,
  },
  date: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.7,
  },
  summary: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 'auto',
    gap: 4,
  },
  viewMore: {
    fontSize: 12,
    fontWeight: '500',
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
    paddingHorizontal: 32,
  },
  footer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    opacity: 0.6,
  },
})
