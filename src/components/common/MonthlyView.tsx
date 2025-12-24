import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { HeatMapData } from '@/types/stats'

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
    const cellMap = new Map(heatmapData.cells.map(cell => [cell.date, cell]))

    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)
    const startDate = new Date(firstDayOfMonth)
    const endDate = new Date(lastDayOfMonth)

    startDate.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay())

    const days: Array<{ date: Date; dateStr: string; isCurrentMonth: boolean; isToday: boolean }> =
      []
    const currentDate = new Date(startDate)

    while (currentDate <= endDate || days.length % 42 !== 0) {
      const dateStr = currentDate.toISOString().split('T')[0]
      const today = new Date()
      const isToday = currentDate.toDateString() === today.toDateString()

      days.push({
        date: new Date(currentDate),
        dateStr,
        isCurrentMonth: currentDate.getMonth() === month,
        isToday,
      })

      currentDate.setDate(currentDate.getDate() + 1)

      if (days.length >= 42) break
    }

    return { days, cellMap }
  }, [year, month, heatmapData])

  const getCellData = (dateStr: string) => {
    return (
      cellMap.get(dateStr) || {
        date: dateStr,
        color: 'transparent',
        moodKey: undefined,
        moodScore: undefined,
      }
    )
  }

  const formatDateTooltip = (dateStr: string) => {
    const cell = getCellData(dateStr)
    const date = new Date(dateStr)
    const weekday = date.toLocaleDateString('zh-CN', { weekday: 'long' })

    if (!cell.moodKey) {
      return `${date.getMonth() + 1}月${date.getDate()}日 · ${weekday} · 无记录`
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

    return `${date.getMonth() + 1}月${date.getDate()}日 · ${weekday} · ${moodLabel} (${score})`
  }

  return (
    <div className="bg-card rounded-xl border shadow-sm p-4">
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
            <div
              key={dateStr}
              className={cn(
                'relative aspect-square flex items-center justify-center text-sm cursor-pointer rounded-lg transition-all hover:scale-105',
                'border border-transparent hover:border-primary/20',
                isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/50',
                isSelected && 'ring-2 ring-primary',
                isToday && 'bg-primary/10'
              )}
              style={{
                backgroundColor: isCurrentMonth ? cellData.color : 'transparent',
                opacity: isCurrentMonth ? 0.7 : 1,
              }}
              onClick={() => isCurrentMonth && onDateClick?.(dateStr)}
              title={formatDateTooltip(dateStr)}
            >
              <span
                className={cn(
                  'font-medium',
                  isToday && 'text-primary font-bold',
                  isSelected && 'text-primary'
                )}
              >
                {date.getDate()}
              </span>
              {isToday && (
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
