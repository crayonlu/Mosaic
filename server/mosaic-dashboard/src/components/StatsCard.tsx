import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiClient } from '../lib/api-client'

interface HeatmapData {
  cells: Array<{
    date: string
    color: string
    count: number
  }>
  startDate: string
  endDate: string
}

export function StatsCard() {
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const data = await apiClient.getHeatmap()
      setHeatmapData(data)
    } catch (error: unknown) {
      console.error('加载统计数据失败', error)
      toast.error('加载统计数据失败')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>
  }

  const weeks = heatmapData ? groupCellsByWeek(heatmapData.cells) : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>活动热力图</CardTitle>
        <CardDescription>过去一年的活动记录</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1">
              {week.map((cell, cellIndex) => (
                <div
                  key={cellIndex}
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: cell.color }}
                  title={`${cell.date}: ${cell.count} 条记录`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-4 text-sm text-stone-500">
          <span>少</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-sm bg-[#ebedf0]" />
            <div className="w-3 h-3 rounded-sm bg-[#9be9a8]" />
            <div className="w-3 h-3 rounded-sm bg-[#40c463]" />
            <div className="w-3 h-3 rounded-sm bg-[#30a14e]" />
            <div className="w-3 h-3 rounded-sm bg-[#216e39]" />
          </div>
          <span>多</span>
        </div>
      </CardContent>
    </Card>
  )
}

function groupCellsByWeek(cells: HeatmapData['cells']) {
  const weeks: HeatmapData['cells'][] = []
  let currentWeek: HeatmapData['cells'] = []

  cells.forEach((cell, index) => {
    const date = new Date(cell.date)
    const dayOfWeek = date.getDay()

    if (dayOfWeek === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek)
      currentWeek = []
    }

    currentWeek.push(cell)

    if (index === cells.length - 1 && currentWeek.length > 0) {
      weeks.push(currentWeek)
    }
  })

  return weeks
}
