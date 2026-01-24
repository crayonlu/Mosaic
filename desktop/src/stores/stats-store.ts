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
      
      const dateCountMap = new Map<string, number>()
      rawData.dates.forEach((date, index) => {
        dateCountMap.set(date, rawData.counts[index])
      })

      const cells: HeatMapData['cells'] = []
      const start = dayjs(startDate)
      const end = dayjs(endDate)
      const today = dayjs().format('YYYY-MM-DD')

      let current = start
      while (current.isBefore(end) || current.isSame(end, 'day')) {
        const dateStr = current.format('YYYY-MM-DD')
        const count = dateCountMap.get(dateStr) || 0
        
        // Calculate color intensity based on count
        let color = '#ebedf0' // default empty color
        if (count > 0) {
          // Generate color based on count (using primary color with different opacities)
          const intensity = Math.min(count / 5, 1) // max at 5 records
          const alpha = 0.2 + intensity * 0.6 // range from 0.2 to 0.8
          color = `hsl(var(--primary) / ${alpha})`
        }

        cells.push({
          date: dateStr,
          count,
          color,
          isToday: dateStr === today,
        })

        current = current.add(1, 'day')
      }

      const data: HeatMapData = {
        dates: rawData.dates,
        counts: rawData.counts,
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
