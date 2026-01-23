import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTheme } from '@/hooks/use-theme'
import type { HeatMapCell, HeatMapData } from '@/types/stats'
import { useMemo } from 'react'

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
  const { weeks, cells } = useMemo(() => {
    const cells = data.cells || []
    const weeks: HeatMapCell[][] = []
    const monthLabels: Array<{ month: number; weekIndex: number }> = []

    const startDate = data.startDate ? new Date(data.startDate) : new Date()
    const endDate = data.endDate ? new Date(data.endDate) : new Date()

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
        const cell = cellMap.get(dateStr)
        if (cell && 'count' in cell && 'isToday' in cell) {
          week.push(cell)
        } else {
          week.push({
            date: dateStr,
            color: '#ebedf0',
            count: 0,
            isToday: false,
          })
        }

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

    return { weeks, cells }
  }, [data])

  const { theme } = useTheme()
  const dark = theme === 'dark'

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">热力图</h3>
          {dark && <span className="text-xs text-muted-foreground">展示{cells.length}天数据</span>}
        </div>
        <div className="space-y-4">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map((cell, cellIndex) => {
                const bgColor = cell.count > 0 ? 'bg-primary/10 hover:bg-primary/20' : 'bg-muted'
                const textColor = cell.count > 0 ? 'text-primary' : 'text-muted-foreground'

                return (
                  <Tooltip key={cellIndex}>
                    <TooltipTrigger>
                      <div
                        className={`
                            ${bgColor}
                            ${textColor}
                            aspect-square
                            flex
                            items-center
                            justify-center
                            rounded-md
                            transition-colors
                            cursor-pointer
                            ${cell.isToday ? 'ring-2 ring-primary' : ''}
                          `}
                        onClick={() => cell.count > 0 && onDateClick && onDateClick(cell.date)}
                      >
                        <span className="text-sm font-medium">{new Date(cell.date).getDate()}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="p-2">{cell.count} 条记录</div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
