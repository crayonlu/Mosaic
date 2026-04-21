import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTheme } from '@/hooks/useTheme'
import type { HeatMapCell, HeatMapDataExtended } from '@/types/stats'
import { getMoodColor, getMoodLabel } from '@mosaic/utils'
import dayjs from 'dayjs'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { cn } from 'src/lib/utils'

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
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const neutralColor = getMoodColor('neutral')
  const today = dayjs().format('YYYY-MM-DD')

  useLayoutEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.clientWidth)
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    if (typeof window === 'undefined' || !window.ResizeObserver) {
      setContainerWidth(containerRef.current.clientWidth)
      return
    }

    const observer = new window.ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 0
      setContainerWidth(width)
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const { weeks } = useMemo(() => {
    const cells = data.cells || []
    const weeks: HeatMapCell[][] = []

    const startDate = data.startDate ? new Date(data.startDate) : new Date()
    const endDate = data.endDate ? new Date(data.endDate) : new Date()

    const cellMap = new Map(cells.map(cell => [cell.date, cell]))

    const firstDayOfWeek = new Date(startDate)
    firstDayOfWeek.setDate(startDate.getDate() - startDate.getDay())

    let currentDate = new Date(firstDayOfWeek)

    while (currentDate <= endDate) {
      const week: HeatMapCell[] = []

      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        if (currentDate > endDate) {
          break
        }

        const dateStr = dayjs(currentDate).format('YYYY-MM-DD')
        const cell = cellMap.get(dateStr) || {
          date: dateStr,
          color: neutralColor,
          count: 0,
          isToday: dateStr === today,
        }
        week.push(cell)

        currentDate.setDate(currentDate.getDate() + 1)
      }

      if (week.length > 0) {
        weeks.push(week)
      }
    }

    return { weeks }
  }, [data, neutralColor, today])

  const visibleWeeks = useMemo(() => {
    if (containerWidth <= 0) {
      return []
    }

    // Keep the widget responsive by showing only as many trailing weeks as the sidebar can fit.
    const cellWidth = 10
    const weekGap = 6
    const maxWeeks = Math.max(1, Math.floor((containerWidth + weekGap) / (cellWidth + weekGap)))

    if (weeks.length <= maxWeeks) {
      return weeks
    }
    return weeks.slice(-maxWeeks)
  }, [containerWidth, weeks])

  const { theme, themeName } = useTheme()
  const dark = theme === 'dark'
  const isCleanSlate = themeName === 'cleanSlate'

  const emptyColor = dark
    ? (isCleanSlate ? '#1e1e1e' : '#2A2B30')
    : (isCleanSlate ? '#D4D4D4' : '#CFC6B8')

  const todayOutlineColor = dark
    ? (isCleanSlate ? '#a8f099' : '#D39B66')
    : (isCleanSlate ? '#16a34a' : '#9A6B3F')

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

    const moodLabel = getMoodLabel(cell.moodKey)
    const score = cell.moodScore || 0

    return `${formattedDate} · ${weekday} · ${moodLabel}${score ? ` (${score})` : ''}`
  }

  return (
    <TooltipProvider>
      <div
        ref={containerRef}
        className="w-full overflow-hidden rounded-xl border py-2 transition-all"
        style={{
          borderColor: dark
            ? (isCleanSlate ? '#262626' : '#3A352D')
            : (isCleanSlate ? '#E5E5E5' : '#D9D2C6'),
          backgroundColor: dark
            ? (isCleanSlate ? '#141414' : '#1F1F22')
            : (isCleanSlate ? '#FFFFFF' : '#F2ECE2'),
        }}
      >
        <div className="mx-auto flex w-fit gap-1.5 justify-start">
          {visibleWeeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1.5">
              {week.map(cell => (
                <Tooltip key={cell.date}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'h-2.5 w-2.5 rounded-sm transition-all duration-150 ease-out',
                        'hover:scale-115 hover:ring-1 hover:ring-primary/30',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'
                      )}
                      style={{
                        backgroundColor: cell.count === 0 ? emptyColor : cell.color,
                        outline:
                          cell.date === today
                            ? `1px solid ${todayOutlineColor}`
                            : 'none',
                        outlineOffset: cell.date === today ? '1px' : '0px',
                      }}
                      onClick={() => onDateClick?.(cell.date)}
                      aria-label={formatTooltipContent(cell)}
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
      </div>
    </TooltipProvider>
  )
}
