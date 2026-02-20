import { SearchFilters } from '@/components/search/SearchFilters'
import { SearchInput } from '@/components/search/SearchInput'
import { SearchResults } from '@/components/search/SearchResults'
import { useSearchMemos } from '@/lib/query'
import { useThemeStore } from '@/stores/theme-store'
import type { MemoWithResources } from '@mosaic/api'
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
    refetch,
  } = useSearchMemos(searchParams)

  const results = useMemo(() => {
    return paginatedData?.pages.flatMap(page => page.items) || []
  }, [paginatedData])

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    results.forEach(memo => {
      memo.tags.forEach(tag => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [results])

  const handleRefresh = useCallback(() => {
    refetch()
  }, [refetch])

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasNextPage) {
      // useInfiniteQuery handles fetchNextPage automatically
    }
  }, [isLoading, hasNextPage])

  const handleMemoPress = useCallback((memo: MemoWithResources) => {
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
