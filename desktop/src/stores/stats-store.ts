import type { HeatMapCell, HeatMapDataExtended } from '@/types/stats'
import { getMoodColor } from '@/utils/mood'
import { useHeatmap } from '@mosaic/api'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'

function buildHeatmapData(
  rawData: NonNullable<ReturnType<typeof useHeatmap>['data']>,
  startDate: string,
  endDate: string
): HeatMapDataExtended {
  const dateInfoMap = new Map<string, { count: number; moodKey?: string }>()
  rawData.dates?.forEach((date: string, index: number) => {
    const moodKey = rawData.moods?.[index] ?? undefined
    dateInfoMap.set(date, {
      count: rawData.counts[index],
      moodKey: moodKey as string | undefined,
    })
  })

  const cells: HeatMapCell[] = []
  const start = dayjs(startDate)
  const end = dayjs(endDate)
  const today = dayjs().format('YYYY-MM-DD')

  let current = start
  while (current.isBefore(end) || current.isSame(end, 'day')) {
    const dateStr = current.format('YYYY-MM-DD')
    const info = dateInfoMap.get(dateStr)
    const count = info?.count || 0
    const moodKey = info?.moodKey

    let color = '#ebedf0'
    if (count > 0 && moodKey) {
      color = getMoodColor(moodKey) || '#ebedf0'
    }

    cells.push({
      date: dateStr,
      count,
      color,
      isToday: dateStr === today,
      moodKey: moodKey as import('@mosaic/api').MoodKey | undefined,
      moodScore:
        rawData.moodScores?.[
          dateInfoMap.get(dateStr)?.count ? rawData.dates.indexOf(dateStr) : 0
        ] ?? undefined,
    })

    current = current.add(1, 'day')
  }

  return {
    dates: rawData.dates,
    counts: rawData.counts,
    moods: rawData.moods as (import('@mosaic/api').MoodKey | null)[],
    moodScores: rawData.moodScores,
    cells,
    startDate,
    endDate,
  }
}

export function useHeatmapQuery() {
  const startDate = dayjs().subtract(6, 'month').format('YYYY-MM-DD')
  const endDate = dayjs().format('YYYY-MM-DD')

  const { data: rawData, ...rest } = useHeatmap({
    start_date: startDate,
    end_date: endDate,
  })

  const heatmapData = rawData ? buildHeatmapData(rawData, startDate, endDate) : undefined

  return {
    ...rest,
    data: heatmapData,
  }
}

export function useHeatmapInvalidate() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['heatmap'] })
  }
}
