import { EmptyState } from '@/components/common/EmptyState'
import { MemoDetail } from '@/components/common/MemoDetail'
import { SearchFilters } from '@/components/common/SearchFilters'
import { SearchInput } from '@/components/common/SearchInput'
import { SearchResults } from '@/components/common/SearchResults'
import { TagCloud } from '@/components/common/TagCloud'
import DeskTopLayout from '@/components/layout/DeskTopLayout'
import { LoadingSpinner } from '@/components/ui/loading/loading-spinner'
import type { MemoWithResources } from '@mosaic/api'
import { useMemoTags, useSearchMemos } from '@mosaic/api'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { Search as SearchIcon } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [isArchived, setIsArchived] = useState<boolean | undefined>(undefined)
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedMemo, setSelectedMemo] = useState<MemoWithResources | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const queryClient = useQueryClient()

  const deferredQuery = useDeferredValue(query)

  const searchRequest = useMemo(
    () => ({
      query: deferredQuery.trim() || '',
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      startDate: startDate ? dayjs(startDate).format('YYYY-MM-DD') : undefined,
      endDate: endDate ? dayjs(endDate).format('YYYY-MM-DD') : undefined,
      isArchived,
      page: 1,
      pageSize: 50,
    }),
    [deferredQuery, selectedTags, startDate, endDate, isArchived]
  )

  const { data: response, isLoading: isPending } = useSearchMemos(searchRequest)
  const { data: allTags = [], isLoading: isTagsLoading } = useMemoTags()

  const results: MemoWithResources[] = response?.items ?? []
  const total = response?.total ?? 0

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(item => item !== tag) : [...prev, tag]
    )
  }

  const handleMemoClick = (memo: MemoWithResources) => {
    setSelectedMemo(memo)
    setIsDetailOpen(true)
  }

  const handleDetailClose = () => {
    setIsDetailOpen(false)
    setTimeout(() => setSelectedMemo(null), 300)
  }

  const handleMemoUpdate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['memos', 'search'] })
  }

  const handleMemoDelete = async () => {
    await queryClient.invalidateQueries({ queryKey: ['memos', 'search'] })
    setIsDetailOpen(false)
    setTimeout(() => setSelectedMemo(null), 300)
  }

  return (
    <DeskTopLayout className="relative">
      <div className="h-full flex flex-col">
        <div className="bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 sticky top-0 z-10">
          <div className="flex items-center gap-4 px-6 pb-4 border-b">
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
            onTagsChange={setSelectedTags}
            total={total}
          />

          <TagCloud
            tags={allTags}
            selectedTags={selectedTags}
            onTagToggle={handleTagToggle}
            isLoading={isTagsLoading}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {isPending ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner size="lg" />
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              icon={SearchIcon}
              title="暂无搜索结果"
              description={
                deferredQuery.trim() ||
                selectedTags.length > 0 ||
                startDate ||
                endDate ||
                isArchived !== undefined
                  ? '尝试调整搜索条件或关键词'
                  : '暂无记录'
              }
            />
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
