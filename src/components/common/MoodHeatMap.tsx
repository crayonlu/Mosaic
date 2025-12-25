import { useMemo } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { HeatMapData, HeatMapCell } from '@/types/stats'

interface MoodHeatMapProps {
  data: HeatMapData
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
    const cells = data.cells
    const weeks: HeatMapCell[][] = []
    const monthLabels: Array<{ month: number; weekIndex: number }> = []

    const startDate = new Date(data.startDate)
    const endDate = new Date(data.endDate)

    const cellMap = new Map(cells.map(cell => [cell.date, cell]))

    const firstDayOfWeek = new Date(startDate)
    firstDayOfWeek.setDate(startDate.getDate() - startDate.getDay())

    let currentDate = new Date(firstDayOfWeek)
    let weekIndex = 0
    let lastMonth = -1

    while (currentDate <= endDate) {
      const week: HeatMapCell[] = []

      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const dateStr = currentDate.toISOString().split('T')[0]
        const cell = cellMap.get(dateStr) || {
          date: dateStr,
          color: '#ebedf0',
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

      weeks.push(week)
      weekIndex++
    }

    return { weeks }
  }, [data])

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
      joy: '愉悦',
      anger: '愤怒',
      sadness: '悲伤',
      calm: '平静',
      anxiety: '焦虑',
      focus: '专注',
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
                    style={{ backgroundColor: cell.color }}
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
