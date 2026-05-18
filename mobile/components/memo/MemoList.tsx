import { MemoListSkeleton } from '@/components/ui'
import { useInfiniteMemos, useMemosByDate } from '@/lib/query'
import { stringUtils } from '@/lib/utils/string'
import { useThemeStore } from '@/stores/themeStore'
import { type MemoWithResources } from '@mosaic/api'
import { FileX } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import Animated, { Easing, FadeInDown } from 'react-native-reanimated'
import { MemoCard } from './MemoCard'

interface MemoListProps {
  date?: string
  onMemoPress: (memo: MemoWithResources) => void
  onMemoDelete?: (id: string) => void
  headerComponent?: React.ComponentType<any> | React.ReactElement | null | undefined
}

export function MemoList({ date, onMemoPress, onMemoDelete, headerComponent }: MemoListProps) {
  const { theme, themeName } = useThemeStore()
  const flatListRef = useRef<FlatList>(null)
  const [refreshing, setRefreshing] = useState(false)
  const hasInitiallyLoaded = useRef(false)

  const { data: memosByDate, isLoading: loadingByDate } = useMemosByDate(date || '', {
    archived: undefined,
  })

  const {
    data: paginatedData,
    isLoading: loadingList,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteMemos({ pageSize: 20 })

  const memos = useMemo(() => {
    if (date) {
      return memosByDate || []
    }
    const items = paginatedData?.pages.flatMap(page => page.items) || []
    return items
  }, [date, memosByDate, paginatedData])

  const isLoading = date ? loadingByDate : loadingList
  const hasMore = date ? false : hasNextPage

  useEffect(() => {
    if (!isLoading && memos.length > 0 && !hasInitiallyLoaded.current) {
      hasInitiallyLoaded.current = true
    }
  }, [isLoading, memos.length])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore && !date) {
      fetchNextPage()
    }
  }, [isLoading, hasMore, date, fetchNextPage])

  const handleDelete = useCallback(
    (id: string) => {
      onMemoDelete?.(id)
    },
    [onMemoDelete]
  )

  const groupedMemos = useMemo(() => {
    const groups: Record<
      string,
      { date: string; displayDate: string; memos: MemoWithResources[] }
    > = {}

    if (date) {
      const displayDate = stringUtils.formatDate(date)
      groups[date] = {
        date,
        displayDate: date === stringUtils.getTodayDateString() ? '今天' : displayDate,
        memos,
      }
    } else {
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
      .map(([, group]) => group)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [memos, date])

  const renderDateHeader = (displayDate: string, memoCount: number, isFirst: boolean) => (
    <View
      style={[
        styles.dateHeader,
        {
          paddingTop: isFirst ? 8 : themeName === 'quietPaper' ? 20 : 16,
          paddingHorizontal: themeName === 'quietPaper' ? 16 : 14,
        },
      ]}
    >
      <View style={styles.dateHeaderLeft}>
        {themeName === 'quietPaper' && (
          <View
            style={{
              width: 3,
              height: 14,
              borderRadius: 1.5,
              backgroundColor: theme.primary,
              marginRight: 8,
            }}
          />
        )}
        <Text
          style={
            themeName === 'quietPaper'
              ? {
                  fontSize: 17,
                  fontWeight: '700',
                  letterSpacing: -0.2,
                  color: theme.text,
                }
              : {
                  fontSize: 12,
                  fontWeight: '500',
                  letterSpacing: 0.8,
                  color: theme.textSecondary,
                  textTransform: 'uppercase',
                }
          }
        >
          {displayDate}
        </Text>
      </View>
      <Text style={[styles.dateHeaderCount, { color: theme.textSecondary }]}>
        {memoCount}
      </Text>
    </View>
  )

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.semantic.infoSoft }]}>
        <FileX size={48} color={theme.primary} strokeWidth={1.5} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        {date ? '今天还没有记录' : '暂无Memo'}
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        {date ? '点击下方按钮创建你的第一条Memo' : '开始记录你的想法和灵感'}
      </Text>
    </View>
  )

  const shouldAnimate = !hasInitiallyLoaded.current

  // Global counter across groups for stagger timing
  const staggerCounter = useRef(0)

  const renderGroup = ({
    item: group,
    index,
  }: {
    item: { date: string; displayDate: string; memos: MemoWithResources[] }
    index: number
  }) => {
    if (index === 0) staggerCounter.current = 0

    return (
      <View key={group.date}>
        {renderDateHeader(group.displayDate, group.memos.length, index === 0)}
        {group.memos.map(memo => {
          const delay = Math.min(staggerCounter.current * 30, 240)
          staggerCounter.current += 1

          const card = (
            <MemoCard
              key={memo.id}
              memo={memo}
              onPress={() => onMemoPress(memo)}
              onDelete={handleDelete}
            />
          )

          if (!shouldAnimate) return card

          return (
            <Animated.View
              key={`anim-${memo.id}`}
              entering={FadeInDown.delay(delay).duration(180).easing(Easing.bezier(0.25, 1, 0.5, 1)).withInitialValues({ transform: [{ translateY: 10 }] })}
            >
              {card}
            </Animated.View>
          )
        })}
      </View>
    )
  }

  const renderFooter = () => {
    if (memos.length === 0) return null
    if (!hasMore) {
      return (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>没有更多了</Text>
        </View>
      )
    }

    if (isFetchingNextPage) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      )
    }

    return null
  }

  if (isLoading) {
    const HeaderComponent = headerComponent
    const Header = typeof HeaderComponent === 'function' ? <HeaderComponent /> : HeaderComponent
    return (
      <View>
        {Header}
        <MemoListSkeleton count={5} />
      </View>
    )
  }

  return (
    <FlatList
      ref={flatListRef}
      data={groupedMemos}
      renderItem={renderGroup}
      keyExtractor={item => item.date}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={headerComponent}
      ListEmptyComponent={renderEmptyState}
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
    paddingBottom: 16,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 6,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  dateHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateHeaderCount: {
    fontSize: 12,
    fontWeight: '400',
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
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
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    fontWeight: '400',
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
