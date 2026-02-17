import type { SummaryData, SummaryQuery, TrendsData } from '@/types/stats'
import { getMoodColor, getMoodLabel } from '@/utils/mood'
import { statsApi } from '@mosaic/api'
import { Calendar as CalendarIcon, Hash, PieChart } from 'lucide-react'
import { useEffect, useState } from 'react'

interface SummaryViewProps {
  year: number
  month: number
}

interface ExtendedSummaryData extends SummaryData {
  moodDistribution?: Record<string, number>
  avgMoodScore?: number
  recordedDays?: number
}

export function SummaryView({ year, month }: SummaryViewProps) {
  const [data, setData] = useState<ExtendedSummaryData | null>(null)
  const [trendsData, setTrendsData] = useState<TrendsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadSummaryData()
  }, [year, month])

  const loadSummaryData = async () => {
    try {
      setIsLoading(true)
      
      const query: SummaryQuery = { year, month }
      const summaryData = await statsApi.getSummary(query)
      setData(summaryData as ExtendedSummaryData)
      
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = month === 12 
        ? `${year + 1}-01-01` 
        : `${year}-${String(month + 1).padStart(2, '0')}-01`
      
      const trendsQuery = { start_date: startDate, end_date: endDate }
      const trends = await statsApi.getTrends(trendsQuery)
      setTrendsData(trends)
    } catch (error) {
      console.error('Failed to load summary data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const renderMoodPieChart = () => {
    if (!trendsData || !trendsData.moods || trendsData.moods.length === 0) return null

    const totalCount = trendsData.moods.reduce((sum, mood) => sum + (mood?.count || 0), 0)
    if (totalCount === 0) return null

    const moodEntries = trendsData.moods.map(mood => ({
      moodKey: mood?.moodKey || 'neutral',
      count: mood?.count || 0,
      percentage: totalCount > 0 ? ((mood?.count || 0) / totalCount) * 100 : 0,
    }))

    const size = 120
    const center = size / 2
    const radius = 40

    let cumulativeAngle = 0

    const paths = moodEntries.map(mood => {
      const angle = (mood.percentage / 100) * 360
      const startAngle = cumulativeAngle
      const endAngle = cumulativeAngle + angle

      const x1 = center + radius * Math.cos((startAngle * Math.PI) / 180)
      const y1 = center + radius * Math.sin((startAngle * Math.PI) / 180)
      const x2 = center + radius * Math.cos((endAngle * Math.PI) / 180)
      const y2 = center + radius * Math.sin((endAngle * Math.PI) / 180)

      const largeArcFlag = angle > 180 ? 1 : 0

      const pathData = [
        `M ${center} ${center}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z',
      ].join(' ')

      cumulativeAngle = endAngle

      return (
        <path
          key={mood.moodKey}
          d={pathData}
          fill={getMoodColor(mood.moodKey)}
          stroke="white"
          strokeWidth="1"
        />
      )
    })

    return (
      <div className="flex items-center justify-center">
        <svg width={size} height={size} className="drop-shadow-sm">
          {paths}
          <circle cx={center} cy={center} r={20} fill="white" stroke="#e5e7eb" strokeWidth="1" />
        </svg>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-card rounded-lg border p-6">
          <div className="h-64 animate-pulse bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            暂无数据
          </div>
        </div>
      </div>
    )
  }

  const topTagsList = trendsData?.tags || []

  const moodDistribution: Record<string, number> = {}
  trendsData?.moods?.forEach(mood => {
    if (mood?.moodKey) {
      moodDistribution[mood.moodKey] = mood.count
    }
  })

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary mb-1">{data.totalMemos}</div>
            <div className="text-xs text-muted-foreground">总笔记数</div>
          </div>
        </div>
        <div className="bg-card rounded-lg border p-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-500 mb-1">{data.totalDiaries}</div>
            <div className="text-xs text-muted-foreground">日记篇数</div>
          </div>
        </div>
        <div className="bg-card rounded-lg border p-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500 mb-1">{data.totalResources}</div>
            <div className="text-xs text-muted-foreground">资源总数</div>
          </div>
        </div>
      </div>

      {/* 情绪分布 */}
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">情绪分布</h3>
        </div>
        <div className="flex items-center gap-8">
          {renderMoodPieChart()}
          <div className="space-y-2">
            {Object.entries(moodDistribution)
              .slice(0, 5)
              .map(([moodKey, count]) => (
                <div key={moodKey} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getMoodColor(moodKey) }}
                    />
                    <span>{getMoodLabel(moodKey)}</span>
                  </div>
                  <span className="text-muted-foreground">{count}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* 热门标签 */}
      {topTagsList.length > 0 && (
        <div className="bg-card rounded-lg border p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Hash className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">热门标签</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {topTagsList.slice(0, 10).map(tag => {
              return (
                <span
                  key={tag.tag}
                  className={`inline-block px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium`}
                >
                  {tag.tag} ({tag.count})
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* 月度概览 */}
      <div className="bg-card rounded-lg border p-6 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <CalendarIcon className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">
            {year}年{month}月概览
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary mb-1">{data.totalDiaries || 0}</div>
            <div className="text-xs text-muted-foreground">记录天数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500 mb-1">
              {Object.keys(moodDistribution).length}
            </div>
            <div className="text-xs text-muted-foreground">情绪种类</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-500 mb-1">{topTagsList.length}</div>
            <div className="text-xs text-muted-foreground">使用标签</div>
          </div>
        </div>
      </div>
    </div>
  )
}
