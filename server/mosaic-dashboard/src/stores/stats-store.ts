import { create } from 'zustand'
import type { HeatMapData } from '../types/stats'

interface StatsState {
  heatmapData: HeatMapData | null
  heatmapLoading: boolean
  loadHeatmap: () => Promise<void>
}

export const useStatsStore = create<StatsState>(set => ({
  heatmapData: null,
  heatmapLoading: false,
  loadHeatmap: async () => {
    set({ heatmapLoading: true })
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/stats/heatmap`)
      const data: HeatMapData = await response.json()
      set({ heatmapData: data })
    } catch (error) {
      console.error('Failed to load heatmap:', error)
    } finally {
      set({ heatmapLoading: false })
    }
  },
}))
