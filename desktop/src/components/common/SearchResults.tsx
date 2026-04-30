import { MemoCard } from '@/components/common/MemoCard'
import { cn } from '@/lib/utils'
import type { Memo } from '@mosaic/api'
import { useMemo } from 'react'

interface SearchResultsProps {
  results: Memo[]
  query: string
  onMemoClick?: (memo: Memo) => void
  className?: string
  semanticEnabled?: boolean
}

export function SearchResults({
  results,
  query,
  onMemoClick,
  className,
  semanticEnabled = false,
}: SearchResultsProps) {
  const searchWords = useMemo(() => {
    if (!query.trim()) return []
    return query
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0)
  }, [query])

  if (results.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-2', className)}>
      {results.map(memo => (
        <MemoCard
          key={memo.id}
          memo={memo}
          searchWords={searchWords}
          onClick={() => onMemoClick?.(memo)}
          showSemanticBadge={
            semanticEnabled && (memo.matchType === 'semantic' || memo.matchType === 'hybrid')
          }
        />
      ))}
    </div>
  )
}
