import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TagResponse } from '@mosaic/api'
import { useMemo } from 'react'

interface TagCloudProps {
  tags: TagResponse[]
  selectedTags: string[]
  onTagToggle: (tag: string) => void
  isLoading?: boolean
}

export function TagCloud({ tags, selectedTags, onTagToggle, isLoading = false }: TagCloudProps) {
  const displayTags = useMemo(() => {
    if (selectedTags.length === 0) return tags

    const selectedTagSet = new Set(selectedTags)
    const selectedMap = new Map(tags.map(item => [item.tag, item]))

    const selectedItems = selectedTags
      .map(tag => selectedMap.get(tag))
      .filter((item): item is TagResponse => Boolean(item))

    const unselectedItems = tags.filter(item => !selectedTagSet.has(item.tag))

    return [...selectedItems, ...unselectedItems]
  }, [tags, selectedTags])

  if (isLoading) {
    return (
      <div className="px-6 py-4 border-b">
        <p className="text-xs text-muted-foreground">标签加载中...</p>
      </div>
    )
  }

  if (tags.length === 0) {
    return (
      <div className="px-6 py-4 border-b">
        <p className="text-xs text-muted-foreground">暂无可用标签</p>
      </div>
    )
  }

  return (
    <div className="px-6 py-4 border-b space-y-2">
      <p className="text-xs text-muted-foreground">全部标签</p>
      <div className="flex flex-wrap gap-2">
        {displayTags.map(item => {
          const isActive = selectedTags.includes(item.tag)

          return (
            <button key={item.tag} type="button" onClick={() => onTagToggle(item.tag)}>
              <Badge
                variant={isActive ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer transition-colors',
                  isActive && 'bg-primary text-primary-foreground'
                )}
              >
                {item.tag}
                <span className="ml-1 opacity-80">{item.count}</span>
              </Badge>
            </button>
          )
        })}
      </div>
    </div>
  )
}
