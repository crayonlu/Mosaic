import type { HeatMapData, HeatMapQuery } from '@/types/stats'
import { statsCommands } from '@/utils/callRust'
import dayjs from 'dayjs'
import { create } from 'zustand'

interface StatsState {
  heatmapData: HeatMapData | null
  heatmapLoading: boolean
  heatmapLoaded: boolean

  loadHeatmap: () => Promise<void>
  resetHeatmap: () => void
}

const moodColors: Record<string, string> = {
  joy: '#FFD93D',
  anger: '#FF6B6B',
  sadness: '#4ECDC4',
  calm: '#95E1D3',
  anxiety: '#FFA07A',
  focus: '#6C5CE7',
  tired: '#A8A8A8',
  neutral: '#ebedf0',
  happy: '#FFD93D',
  sad: '#4ECDC4',
  angry: '#FF6B6B',
  anxious: '#FFA07A',
  excited: '#FFA500',
}

export const useStatsStore = create<StatsState>((set, get) => ({
  heatmapData: null,
  heatmapLoading: false,
  heatmapLoaded: false,

  loadHeatmap: async () => {
    const { heatmapLoaded, heatmapLoading } = get()

    if (heatmapLoaded || heatmapLoading) {
      return
    }

    try {
      set({ heatmapLoading: true })

      const endDate = dayjs().format('YYYY-MM-DD')
      const startDate = dayjs().subtract(6, 'month').format('YYYY-MM-DD')

      const query: HeatMapQuery = {
        startDate,
        endDate,
      }

      const rawData = await statsCommands.getHeatmap(query)

      // Build a map of date to count and mood from API response
      const dateInfoMap = new Map<string, { count: number; moodKey?: string }>()
      rawData.dates.forEach((date, index) => {
        const moodKey = rawData.moods?.[index] ?? undefined
        dateInfoMap.set(date, {
          count: rawData.counts[index],
          moodKey: moodKey as string | undefined,
        })
      })

      const cells: HeatMapData['cells'] = []
      const start = dayjs(startDate)
      const end = dayjs(endDate)
      const today = dayjs().format('YYYY-MM-DD')

      let current = start
      while (current.isBefore(end) || current.isSame(end, 'day')) {
        const dateStr = current.format('YYYY-MM-DD')
        const info = dateInfoMap.get(dateStr)
        const count = info?.count || 0
        const moodKey = info?.moodKey

        // Calculate color based on mood
        let color = '#ebedf0' // default empty color
        if (count > 0 && moodKey) {
          color = moodColors[moodKey] || '#ebedf0'
        }

        cells.push({
          date: dateStr,
          count,
          color,
          isToday: dateStr === today,
          moodKey,
          moodScore:
            rawData.moodScores?.[
              dateInfoMap.get(dateStr)?.count ? rawData.dates.indexOf(dateStr) : 0
            ] ?? undefined,
        })

        current = current.add(1, 'day')
      }

      const data: HeatMapData = {
        dates: rawData.dates,
        counts: rawData.counts,
        moods: rawData.moods,
        moodScores: rawData.moodScores,
        cells,
        startDate,
        endDate,
      }

      set({
        heatmapData: data,
        heatmapLoaded: true,
        heatmapLoading: false,
      })
    } catch (error) {
      console.error('加载热力图数据失败:', error)
      set({
        heatmapData: null,
        heatmapLoading: false,
      })
    }
  },

  resetHeatmap: () => {
    set({
      heatmapData: null,
      heatmapLoading: false,
      heatmapLoaded: false,
    })
  },
}))
