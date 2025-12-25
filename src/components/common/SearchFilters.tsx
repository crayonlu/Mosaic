import { Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Badge } from '@/components/ui/badge'
import dayjs from 'dayjs'

interface SearchFiltersProps {
  isArchived?: boolean
  onArchivedChange?: (value: boolean | undefined) => void
  startDate?: Date
  endDate?: Date
  onStartDateChange?: (date: Date | undefined) => void
  onEndDateChange?: (date: Date | undefined) => void
  selectedTags?: string[]
  availableTags?: string[]
  onTagsChange?: (tags: string[]) => void
  total?: number
}

export function SearchFilters({
  isArchived,
  onArchivedChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  selectedTags = [],
  availableTags = [],
  onTagsChange,
  total,
}: SearchFiltersProps) {
  const hasActiveFilters =
    isArchived !== undefined || startDate || endDate || selectedTags.length > 0

  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange?.(selectedTags.filter(t => t !== tag))
    } else {
      onTagsChange?.([...selectedTags, tag])
    }
  }

  const handleClearFilters = () => {
    onArchivedChange?.(undefined)
    onStartDateChange?.(undefined)
    onEndDateChange?.(undefined)
    onTagsChange?.([])
  }

  const activeFilterChips = []
  if (isArchived !== undefined) {
    activeFilterChips.push({
      label: isArchived ? '已归档' : '未归档',
      onRemove: () => onArchivedChange?.(undefined),
    })
  }
  if (startDate || endDate) {
    const dateLabel =
      startDate && endDate
        ? `${dayjs(startDate).format('YYYY-MM-DD')} 至 ${dayjs(endDate).format('YYYY-MM-DD')}`
        : startDate
          ? `从 ${dayjs(startDate).format('YYYY-MM-DD')}`
          : `至 ${dayjs(endDate).format('YYYY-MM-DD')}`
    activeFilterChips.push({
      label: dateLabel,
      onRemove: () => {
        onStartDateChange?.(undefined)
        onEndDateChange?.(undefined)
      },
    })
  }
  selectedTags.forEach(tag => {
    activeFilterChips.push({
      label: tag,
      onRemove: () => handleTagToggle(tag),
    })
  })

  return (
    <div className="space-y-3 px-6 py-3 border-b">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground mr-2">状态:</span>
            <Button
              variant={isArchived === undefined ? 'default' : 'outline'}
              size="sm"
              onClick={() => onArchivedChange?.(undefined)}
              className="h-7 text-xs"
            >
              全部
            </Button>
            <Button
              variant={isArchived === true ? 'default' : 'outline'}
              size="sm"
              onClick={() => onArchivedChange?.(true)}
              className="h-7 text-xs"
            >
              已归档
            </Button>
            <Button
              variant={isArchived === false ? 'default' : 'outline'}
              size="sm"
              onClick={() => onArchivedChange?.(false)}
              className="h-7 text-xs"
            >
              未归档
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">日期:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-3 text-xs gap-1 min-w-[120px]"
                >
                  <Calendar className="h-3 w-3" />
                  {startDate || endDate
                    ? `${startDate ? dayjs(startDate).format('MM-DD') : '...'} - ${endDate ? dayjs(endDate).format('MM-DD') : '...'}`
                    : '选择日期范围'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="start">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-2">开始日期</div>
                      <CalendarComponent
                        mode="single"
                        selected={startDate}
                        onSelect={date => onStartDateChange?.(date)}
                        className="rounded-md border"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-2">结束日期</div>
                      <CalendarComponent
                        mode="single"
                        selected={endDate}
                        onSelect={date => onEndDateChange?.(date)}
                        className="rounded-md border"
                      />
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        {total !== undefined && (
          <Badge variant="secondary" className="text-xs">
            找到 {total} 条结果
          </Badge>
        )}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            清除所有
          </Button>
        )}
      </div>
    </div>
  )
}
