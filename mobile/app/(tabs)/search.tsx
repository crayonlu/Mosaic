import { SearchFilters } from '@/components/search/SearchFilters'
import { SearchInput } from '@/components/search/SearchInput'
import { SearchResults } from '@/components/search/SearchResults'
import { toast } from '@/components/ui'
import { memosApi } from '@/lib/api'
import { useThemeStore } from '@/stores/theme-store'
import type { MemoWithResources } from '@/types/memo'
import { router } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'

export default function SearchScreen() {
  const { theme } = useThemeStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MemoWithResources[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
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

  const performSearch = useCallback(
    async (loadMore = false) => {
      if (!hasSearchCriteria) {
        setResults([])
        return
      }

      try {
        if (!loadMore) {
          setLoading(true)
        }

        const currentPage = loadMore ? page : 1
        const response = await memosApi.search({
          query: query.trim(),
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          isArchived,
          startDate,
          endDate,
          page: currentPage,
          pageSize: 20,
        })

        if (loadMore) {
          setResults(prev => [...prev, ...response.items])
        } else {
          setResults(response.items)
          setPage(1)
        }

        setHasMore(response.page < response.totalPages)
      } catch (error) {
        console.error('Search error:', error)
        toast.error('错误', '搜索失败')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [query, selectedTags, isArchived, startDate, endDate, page, hasSearchCriteria]
  )

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch()
    }, 300)

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selectedTags, isArchived, startDate, endDate])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    setPage(1)
    performSearch()
  }, [performSearch])

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1)
      performSearch(true)
    }
  }, [loading, hasMore, performSearch])

  const handleMemoPress = useCallback((memo: MemoWithResources) => {
    router.push({ pathname: '/memo/[id]', params: { id: memo.id } })
  }, [])

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    results.forEach(memo => {
      memo.tags.forEach(tag => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [results])

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
          loading={loading}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          onRefresh={handleRefresh}
          refreshing={refreshing}
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
    padding: 16,
    gap: 12,
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
})
