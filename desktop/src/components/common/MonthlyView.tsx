import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { HeatMapData } from '@/types/stats'
import { useTheme } from '@/hooks/use-theme'
import dayjs from 'dayjs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
interface MonthlyViewProps {
  year: number
  month: number
  heatmapData: HeatMapData
  selectedDate?: string
  onDateClick?: (date: string) => void
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

export function MonthlyView({
  year,
  month,
  heatmapData,
  selectedDate,
  onDateClick,
}: MonthlyViewProps) {
  const { days, cellMap } = useMemo(() => {
    const cells = heatmapData.cells || []
    const cellMap = new Map(cells.map(cell => [cell.date, cell]))

    const firstDayOfMonth = dayjs().year(year).month(month).date(1)
    const lastDayOfMonth = dayjs()
      .year(year)
      .month(month + 1)
      .date(0)
    const startDate = firstDayOfMonth.startOf('week')
    const endDate = lastDayOfMonth.endOf('week')

    const days: Array<{
      date: dayjs.Dayjs
      dateStr: string
      isCurrentMonth: boolean
      isToday: boolean
    }> = []
    let currentDate = startDate

    while (currentDate.isBefore(endDate) || currentDate.isSame(endDate, 'day')) {
      const dateStr = currentDate.format('YYYY-MM-DD')
      const today = dayjs()
      const isToday = currentDate.isSame(today, 'day')

      days.push({
        date: currentDate,
        dateStr,
        isCurrentMonth: currentDate.month() === month,
        isToday,
      })

      currentDate = currentDate.add(1, 'day')
    }

    return { days, cellMap }
  }, [year, month, heatmapData])

  const getCellData = (dateStr: string) => {
    const cell = cellMap.get(dateStr)
    if (cell && 'count' in cell) {
      return cell
    }
    return {
      date: dateStr,
      color: 'transparent',
      count: 0,
      isToday: false,
    }
  }

  const formatDateTooltip = (dateStr: string) => {
    const cell = getCellData(dateStr)
    const date = dayjs(dateStr)
    const weekday = date.format('dddd')

    if (!cell.moodKey) {
      return `${date.month() + 1}月${date.date()}日 · ${weekday} · 无记录`
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

    return `${date.month() + 1}月${date.date()}日 · ${weekday} · ${moodLabel} (${score})`
  }

  const { theme } = useTheme()
  const dark = theme === 'dark'

  return (
    <TooltipProvider>
      <div className="bg-card rounded-xl border p-4">
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold">
            {year}年{month + 1}月
          </h3>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map(day => (
            <div key={day} className="text-center text-xs text-muted-foreground py-2 font-medium">
              {day}
            </div>
          ))}

          {days.map(({ date, dateStr, isCurrentMonth, isToday }) => {
            const cellData = getCellData(dateStr)
            const isSelected = selectedDate === dateStr

            return (
              <Tooltip key={dateStr}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'relative aspect-square flex items-center justify-center text-sm cursor-pointer rounded-lg transition-all hover:scale-105',
                      'border border-transparent hover:border-primary/20',
                      isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/50',
                      isSelected && 'ring-2 ring-primary',
                      isToday && 'bg-primary/10'
                    )}
                    style={{
                      backgroundColor:
                        cellData.color === '#ebedf0'
                          ? dark
                            ? '#161B2f'
                            : '#ebedf0'
                          : cellData.color,
                      opacity: isCurrentMonth ? 0.7 : 1,
                    }}
                    onClick={() => isCurrentMonth && onDateClick?.(dateStr)}
                  >
                    <span
                      className={cn(
                        'font-medium',
                        isToday && 'text-primary font-bold',
                        isSelected && 'text-primary'
                      )}
                    >
                      {date.date()}
                    </span>
                    {isToday && (
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{formatDateTooltip(dateStr)}</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </div>
    </TooltipProvider>
  )
}
