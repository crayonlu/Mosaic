import { useState, useDeferredValue, useTransition, useEffect, useMemo } from 'react'
import { Search as SearchIcon, Loader2 } from 'lucide-react'
import DeskTopLayout from '@/components/layout/DeskTopLayout'
import { SearchInput } from '@/components/common/SearchInput'
import { SearchResults } from '@/components/common/SearchResults'
import { SearchFilters } from '@/components/common/SearchFilters'
import { MemoDetail } from '@/components/common/MemoDetail'
import { memoCommands } from '@/utils/callRust'
import type { MemoWithResources, SearchMemosRequest } from '@/types/memo'
import dayjs from 'dayjs'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [isArchived, setIsArchived] = useState<boolean | undefined>(undefined)
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [results, setResults] = useState<MemoWithResources[]>([])
  const [total, setTotal] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [selectedMemo, setSelectedMemo] = useState<MemoWithResources | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const deferredQuery = useDeferredValue(query)

  const searchRequest = useMemo<SearchMemosRequest>(() => {
    return {
      query: deferredQuery.trim() || undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      startDate: startDate ? dayjs(startDate).format('YYYY-MM-DD') : undefined,
      endDate: endDate ? dayjs(endDate).format('YYYY-MM-DD') : undefined,
      isArchived,
      page: 1,
      pageSize: 50,
    }
  }, [deferredQuery, selectedTags, startDate, endDate, isArchived])

  useEffect(() => {
    const performSearch = async () => {
      if (
        !deferredQuery.trim() &&
        !selectedTags.length &&
        !startDate &&
        !endDate &&
        isArchived === undefined
      ) {
        setResults([])
        setTotal(0)
        return
      }

      startTransition(async () => {
        try {
          const response = await memoCommands.searchMemos(searchRequest)
          setResults(response.items)
          setTotal(response.total)
        } catch (error) {
          console.error('搜索失败:', error)
          setResults([])
          setTotal(0)
        }
      })
    }

    performSearch()
  }, [searchRequest])

  const handleMemoClick = (memo: MemoWithResources) => {
    setSelectedMemo(memo)
    setIsDetailOpen(true)
  }

  const handleDetailClose = () => {
    setIsDetailOpen(false)
    setTimeout(() => setSelectedMemo(null), 300)
  }

  const handleMemoUpdate = async () => {
    if (selectedMemo) {
      const updatedMemo = await memoCommands.getMemo(selectedMemo.id)
      setSelectedMemo(updatedMemo)
    }
    const response = await memoCommands.searchMemos(searchRequest)
    setResults(response.items)
    setTotal(response.total)
  }

  const handleMemoDelete = async () => {
    const response = await memoCommands.searchMemos(searchRequest)
    setResults(response.items)
    setTotal(response.total)
    setIsDetailOpen(false)
    setTimeout(() => setSelectedMemo(null), 300)
  }

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    results.forEach(memo => {
      memo.tags.forEach(tag => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [results])

  return (
    <DeskTopLayout className="relative">
      <div className="h-full flex flex-col">
        <div className="bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 sticky top-0 z-10">
          <div className="flex items-center gap-4 px-6 pt-2 pb-4 border-b">
            <div className="flex items-center gap-2">
              <SearchIcon className="h-5 w-5" />
              <span className="text-lg font-semibold">搜索</span>
            </div>
            <div className="flex-1 max-w-2xl">
              <SearchInput value={query} onChange={setQuery} placeholder="搜索内容或标签..." />
            </div>
          </div>

          <SearchFilters
            isArchived={isArchived}
            onArchivedChange={setIsArchived}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            selectedTags={selectedTags}
            availableTags={allTags}
            onTagsChange={setSelectedTags}
            total={total}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {isPending ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center h-full">
              <SearchIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">暂无搜索结果</h3>
              <p className="text-sm text-muted-foreground">
                {query.trim() ||
                selectedTags.length > 0 ||
                startDate ||
                endDate ||
                isArchived !== undefined
                  ? '尝试调整搜索条件'
                  : '输入关键词开始搜索'}
              </p>
            </div>
          ) : (
            <div className="p-6">
              <SearchResults
                results={results}
                query={deferredQuery}
                onMemoClick={handleMemoClick}
              />
            </div>
          )}
        </div>

        <MemoDetail
          memo={selectedMemo}
          open={isDetailOpen}
          onClose={handleDetailClose}
          onUpdate={handleMemoUpdate}
          onDelete={handleMemoDelete}
        />
      </div>
    </DeskTopLayout>
  )
}
