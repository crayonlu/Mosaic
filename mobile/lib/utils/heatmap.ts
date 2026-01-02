import type { HeatmapData } from '@/types'

export const heatmapUtils = {
  generate: (memos: { createdAt: string }[]): HeatmapData => {
    const dayCounts: Record<string, number> = {}

    memos.forEach(memo => {
      const date = memo.createdAt.split('T')[0]
      dayCounts[date] = (dayCounts[date] || 0) + 1
    })

    const maxCount = Math.max(...Object.values(dayCounts), 0)

    const days = Object.entries(dayCounts).map(([date, count]) => {
      let level: 0 | 1 | 2 | 3 | 4 = 0
      if (count > 0) {
        const ratio = count / maxCount
        if (ratio >= 0.75) level = 4
        else if (ratio >= 0.5) level = 3
        else if (ratio >= 0.25) level = 2
        else level = 1
      }

      return { date, count, level }
    })

    return {
      days,
      maxCount,
      totalMemos: memos.length,
      streak: 0,
    }
  },
}
