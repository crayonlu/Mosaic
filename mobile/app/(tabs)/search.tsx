import { SearchFilters } from '@/components/search/SearchFilters'
import { SearchInput } from '@/components/search/SearchInput'
import { SearchResults } from '@/components/search/SearchResults'
import { useMemoTags, useSearchMemos } from '@/lib/query'
import { useThemeStore } from '@/stores/themeStore'
import type { Memo } from '@mosaic/api'
import { router } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'

export default function SearchScreen() {
  const { theme } = useThemeStore()
  const [query, setQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isArchived, setIsArchived] = useState<boolean | undefined>(undefined)
  const [startDate, setStartDate] = useState<string | undefined>(undefined)
  const [endDate, setEndDate] = useState<string | undefined>(undefined)

  const hasSearchCriteria = useMemo(() => {
    return (
      query.trim() ||
      selectedTags.length > 0 ||
      isArchived !== undefined ||
      startDate !== undefined ||
      endDate !== undefined
    )
  }, [query, selectedTags, isArchived, startDate, endDate])

  const searchParams = useMemo(
    () => ({
      query: query.trim(),
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      isArchived,
      startDate,
      endDate,
      pageSize: 20,
    }),
    [query, selectedTags, isArchived, startDate, endDate]
  )

  const {
    data: paginatedData,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useSearchMemos(searchParams)

  const { data: tagsData } = useMemoTags()

  const results = useMemo(() => {
    return paginatedData?.pages.flatMap(page => page.memos) || []
  }, [paginatedData])

  const allTags = useMemo(() => {
    return (tagsData || []).map(item => item.tag)
  }, [tagsData])

  const handleRefresh = useCallback(() => {
    refetch()
  }, [refetch])

  const handleLoadMore = useCallback(() => {
    if (!isLoading && !isFetchingNextPage && hasNextPage) {
      fetchNextPage()
    }
  }, [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage])

  const handleMemoPress = useCallback((memo: Memo) => {
    router.push({ pathname: '/memo/[id]', params: { id: memo.id } })
  }, [])

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <SearchFilters
          selectedTags={selectedTags}
          availableTags={allTags}
          onTagsChange={setSelectedTags}
          isArchived={isArchived}
          onArchivedChange={setIsArchived}
          startDate={startDate}
          endDate={endDate}
          onDateRangeChange={(start, end) => {
            setStartDate(start)
            setEndDate(end)
          }}
        />
        <SearchInput value={query} onChangeText={setQuery} style={{ flex: 1 }} />
      </View>

      <View style={styles.resultsContainer}>
        <SearchResults
          results={results}
          loading={isLoading}
          hasMore={hasNextPage || false}
          onLoadMore={handleLoadMore}
          onRefresh={handleRefresh}
          refreshing={isFetchingNextPage}
          onMemoPress={handleMemoPress}
          emptyQuery={!hasSearchCriteria}
          semanticEnabled={paginatedData?.pages?.[0]?.semanticEnabled ?? false}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 4,
    paddingTop: 0,
  },
  resultsContainer: {
    flex: 1,
  },
})
