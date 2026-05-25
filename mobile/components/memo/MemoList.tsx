import { MemoListSkeleton } from '@/components/ui'
import { useInfiniteMemos, useMemo as useMemoQuery, useMemosByDate } from '@/lib/query'
import { stringUtils } from '@/lib/utils/string'
import { useThemeStore } from '@/stores/themeStore'
import { type MemoWithResources } from '@mosaic/api'
import { FileX } from 'lucide-react-native'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, { Easing, FadeIn } from 'react-native-reanimated'
import { MemoCard } from './MemoCard'

const ListMemoCard = React.memo(function ListMemoCard({
  memo: initialMemo,
  onPress,
  onDelete,
  index,
}: {
  memo: MemoWithResources
  onPress: (memo: MemoWithResources) => void
  onDelete: (id: string) => void
  index: number
}) {
  // Read from normalized cache so all pages share the same object reference
  const { data: cachedMemo } = useMemoQuery(initialMemo.id)
  const memo = cachedMemo ?? initialMemo
  const handlePress = useCallback(() => onPress(memo), [memo, onPress])
  return (
    <Animated.View
      entering={FadeIn.delay(index < 8 ? index * 30 : 0)
        .duration(200)
        .easing(Easing.out(Easing.cubic))}
    >
      <MemoCard memo={memo} onPress={handlePress} onDelete={onDelete} />
    </Animated.View>
  )
})

interface MemoListProps {
  date?: string
  onMemoPress: (memo: MemoWithResources) => void
  onMemoDelete?: (id: string) => void
  headerComponent?: React.ComponentType<any> | React.ReactElement | null | undefined
}

interface MemoSection {
  title: string
  date: string
  data: MemoWithResources[]
}

export function MemoList({ date, onMemoPress, onMemoDelete, headerComponent }: MemoListProps) {
  const { t } = useTranslation()
  const { theme } = useThemeStore()
  const sectionListRef = useRef<SectionList<MemoWithResources, MemoSection>>(null)
  const [refreshing, setRefreshing] = useState(false)

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

  const sections: MemoSection[] = useMemo(() => {
    const groups: Record<
      string,
      { date: string; displayDate: string; memos: MemoWithResources[] }
    > = {}

    if (date) {
      const displayDate = stringUtils.formatDate(date)
      groups[date] = {
        date,
        displayDate: date === stringUtils.getTodayDateString() ? t('date.today') : displayDate,
        memos,
      }
    } else {
      memos.forEach(memo => {
        const memoDate = stringUtils.getDateStringFromTimestamp(memo.createdAt)
        const today = stringUtils.getTodayDateString()

        let displayDate: string
        if (memoDate === today) {
          displayDate = t('date.today')
        } else if (memoDate === stringUtils.getYesterdayDateString()) {
          displayDate = t('date.yesterday')
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
      .map(([, group]) => ({
        title: group.displayDate,
        date: group.date,
        data: group.memos,
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [t, memos, date])

  const renderSectionHeader = useCallback(
    ({ section }: { section: MemoSection }) => {
      const isFirst = sections.length > 0 && section.date === sections[0].date
      return (
        <View
          style={[
            styles.dateHeader,
            {
              borderTopColor: theme.border,
              borderTopWidth: isFirst ? 0 : StyleSheet.hairlineWidth,
            },
            isFirst && { marginTop: 0 },
          ]}
        >
          <Text style={[styles.dateHeaderText, { color: theme.text }]}>{section.title}</Text>
          {section.data.length > 0 && (
            <Text style={[styles.dateHeaderCount, { color: theme.textSecondary }]}>
              {t('memo.count', { count: section.data.length })}
            </Text>
          )}
        </View>
      )
    },
    [t, sections, theme.border, theme.text, theme.textSecondary]
  )

  const renderItem = useCallback(
    ({ item, index }: { item: MemoWithResources; index: number }) => (
      <ListMemoCard memo={item} onPress={onMemoPress} onDelete={handleDelete} index={index} />
    ),
    [onMemoPress, handleDelete]
  )

  const renderEmptyState = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIcon]}>
          <FileX size={48} color={theme.primary} strokeWidth={1.5} />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          {date ? t('memo.emptyToday') : t('memo.empty')}
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
          {date ? t('memo.emptyTodayHint') : t('memo.emptyHint')}
        </Text>
      </View>
    ),
    [t, date, theme.primary, theme.text, theme.textSecondary]
  )

  const renderFooter = useMemo(() => {
    if (memos.length === 0) return null
    if (!hasMore) {
      return (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            {t('common.noMore')}
          </Text>
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
  }, [memos.length, hasMore, isFetchingNextPage, theme.textSecondary, theme.primary])

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
    <SectionList<MemoWithResources, MemoSection>
      ref={sectionListRef}
      sections={sections}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.listContent}
      maxToRenderPerBatch={15}
      removeClippedSubviews={true}
      updateCellsBatchingPeriod={50}
      windowSize={7}
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
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
    />
  )
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 8,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingBottom: 6,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  dateHeaderText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateHeaderCount: {
    fontSize: 12,
    opacity: 0.7,
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
