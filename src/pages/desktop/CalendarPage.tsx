import { useState, useEffect } from 'react'
import { Calendar, List, BarChart3 } from 'lucide-react'
import DeskTopLayout from '@/components/layout/DeskTopLayout'
import { MoodHeatMap } from '@/components/common/MoodHeatMap'
import { MonthlyView } from '@/components/common/MonthlyView'
import { TimelineView } from '@/components/common/TimelineView'
import { SummaryView } from '@/components/common/SummaryView'
import { Button } from '@/components/ui/button'
import { statsCommands } from '@/utils/callRust'
import type { HeatMapData, HeatMapQuery } from '@/types/stats'

type ViewMode = 'heatmap' | 'timeline' | 'summary'

export default function CalendarPage() {
  const [heatmapData, setHeatmapData] = useState<HeatMapData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth())
  const [viewMode, setViewMode] = useState<ViewMode>('heatmap')

  const viewModes = [
    { id: 'heatmap' as ViewMode, label: '情绪热力图', icon: Calendar },
    { id: 'timeline' as ViewMode, label: '心情时间线', icon: List },
    { id: 'summary' as ViewMode, label: '月度分析', icon: BarChart3 },
  ]

  useEffect(() => {
    loadHeatmapData()
  }, [])

  const loadHeatmapData = async () => {
    try {
      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const query: HeatMapQuery = {
        startDate,
        endDate,
      }

      const data = await statsCommands.getHeatmap(query)
      setHeatmapData(data)
    } catch (error) {
      console.error('Failed to load heatmap data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMonthClick = (month: number) => {
    setSelectedMonth(month)
  }

  const handleHeatmapDateClick = (date: string) => {
    const clickedDate = new Date(date)
    setSelectedMonth(clickedDate.getMonth())
  }

  const renderViewContent = () => {
    switch (viewMode) {
      case 'heatmap':
        return (
          <div className="space-y-6">
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold">年度情绪热力图</h2>
              </div>
              <div className="bg-card p-4 rounded-xl border shadow-sm overflow-x-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : heatmapData ? (
                  <MoodHeatMap
                    data={heatmapData}
                    selectedMonth={selectedMonth}
                    onMonthClick={handleMonthClick}
                    onDateClick={handleHeatmapDateClick}
                  />
                ) : (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    暂无数据
                  </div>
                )}
              </div>
            </section>

            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold">
                  {new Date().getFullYear()}年{selectedMonth + 1}月详情
                </h2>
              </div>
              {heatmapData && (
                <MonthlyView
                  year={new Date().getFullYear()}
                  month={selectedMonth}
                  heatmapData={heatmapData}
                />
              )}
            </section>
          </div>
        )

      case 'timeline':
        return (
          <div className="space-y-6">
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold">心情时间线</h2>
                <p className="text-sm text-muted-foreground">按时间顺序浏览你的心情记录</p>
              </div>
              <div className="bg-card p-6 rounded-xl border shadow-sm">
                {heatmapData && (
                  <TimelineView startDate={heatmapData.startDate} endDate={heatmapData.endDate} />
                )}
              </div>
            </section>
          </div>
        )

      case 'summary':
        return (
          <div className="space-y-6">
            <section>
              <div className="bg-card p-6 rounded-xl border shadow-sm">
                <SummaryView year={new Date().getFullYear()} month={selectedMonth + 1} />
              </div>
            </section>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <DeskTopLayout>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">情绪日历</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>平静</span>
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-200" />
              <div className="w-2 h-2 rounded-full bg-blue-500" />
            </div>
            <span className="ml-2">愉悦</span>
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-200" />
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
            </div>
          </div>
        </div>

        <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
          {viewModes.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant={viewMode === id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode(id)}
              className="flex items-center gap-2"
            >
              <Icon className="w-4 h-4" />
              {label}
            </Button>
          ))}
        </div>

        {renderViewContent()}
      </div>
    </DeskTopLayout>
  )
}
