import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTheme } from '@/hooks/use-theme'
import type { HeatMapCell, HeatMapDataExtended } from '@/types/stats'
import { useMemo } from 'react'

interface MoodHeatMapProps {
  data: HeatMapDataExtended
  onDateClick?: (date: string) => void
  selectedMonth?: number
  onMonthClick?: (month: number) => void
}

export function MoodHeatMap({
  data,
  onDateClick,
  selectedMonth: _selectedMonth,
  onMonthClick: _onMonthClick,
}: MoodHeatMapProps) {
  const { weeks } = useMemo(() => {
    const cells = data.cells || []
    const weeks: HeatMapCell[][] = []
    const monthLabels: Array<{ month: number; weekIndex: number }> = []

    const startDate = data.startDate ? new Date(data.startDate) : new Date()
    const endDate = data.endDate ? new Date(data.endDate) : new Date()

    const cellMap = new Map(cells.map(cell => [cell.date, cell]))

    const firstDayOfWeek = new Date(startDate)
    firstDayOfWeek.setDate(startDate.getDate() - startDate.getDay())

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let currentDate = new Date(firstDayOfWeek)
    let weekIndex = 0
    let lastMonth = -1
    let reachedEnd = false

    while (currentDate <= endDate && !reachedEnd) {
      const week: HeatMapCell[] = []

      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        if (currentDate > today) {
          reachedEnd = true
          break
        }

        const dateStr = currentDate.toISOString().split('T')[0]
        const cell = cellMap.get(dateStr) || {
          date: dateStr,
          color: '#ebedf0',
          count: 0,
          isToday: false,
        }
        week.push(cell)

        const currentMonth = currentDate.getMonth()
        if (currentMonth !== lastMonth && dayOfWeek === 0) {
          monthLabels.push({
            month: currentMonth,
            weekIndex,
          })
          lastMonth = currentMonth
        }

        currentDate.setDate(currentDate.getDate() + 1)
      }

      if (week.length > 0) {
        weeks.push(week)
      }
      weekIndex++
    }

    return { weeks }
  }, [data])

  const { theme } = useTheme()
  const dark = theme === 'dark'

  const formatTooltipContent = (cell: HeatMapCell) => {
    const date = new Date(cell.date)
    const weekday = date.toLocaleDateString('zh-CN', { weekday: 'long' })
    const formattedDate = date.toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric',
    })

    if (!cell.moodKey) {
      return `${formattedDate} · ${weekday} · 无记录`
    }

    const moodLabels: Record<string, string> = {
      happy: '愉悦',
      angry: '愤怒',
      sad: '悲伤',
      calm: '平静',
      anxious: '焦虑',
      excited: '兴奋',
      tired: '疲惫',
      neutral: '中性',
    }

    const moodLabel = moodLabels[cell.moodKey] || cell.moodKey
    const score = cell.moodScore || 0

    return `${formattedDate} · ${weekday} · ${moodLabel} (${score})`
  }

  return (
    <TooltipProvider>
      <div className="overflow-x-auto overflow-y-hidden flex gap-1 justify-start">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {week.map(cell => (
              <Tooltip key={cell.date}>
                <TooltipTrigger asChild>
                  <div
                    className="w-3 h-3 rounded-sm cursor-pointer transition-all hover:scale-110 hover:ring-1 hover:ring-primary/30"
                    style={{
                      backgroundColor:
                        cell.color === '#ebedf0' ? (dark ? '#161B2f' : '#ebedf0') : cell.color,
                    }}
                    onClick={() => onDateClick?.(cell.date)}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{formatTooltipContent(cell)}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        ))}
      </div>
    </TooltipProvider>
  )
}
