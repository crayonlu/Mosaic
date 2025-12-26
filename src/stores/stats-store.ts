import { create } from 'zustand'
import { statsCommands } from '@/utils/callRust'
import type { HeatMapData, HeatMapQuery } from '@/types/stats'
import dayjs from 'dayjs'

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

      const data = await statsCommands.getHeatmap(query)
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
