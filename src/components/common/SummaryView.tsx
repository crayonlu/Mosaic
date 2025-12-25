import { useState, useEffect } from 'react'
import { PieChart, BarChart3, Hash, Calendar as CalendarIcon } from 'lucide-react'
import { statsCommands } from '@/utils/callRust'
import { getMoodEmoji, getMoodLabel } from '@/utils/moodEmoji'
import type { SummaryData, SummaryQuery } from '@/types/stats'

interface SummaryViewProps {
  year: number
  month: number
}

export function SummaryView({ year, month }: SummaryViewProps) {
  const [data, setData] = useState<SummaryData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadSummaryData()
  }, [year, month])

  const loadSummaryData = async () => {
    try {
      setIsLoading(true)
      const query: SummaryQuery = { year, month }
      const summaryData = await statsCommands.getSummary(query)
      setData(summaryData)
    } catch (error) {
      console.error('Failed to load summary data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const renderMoodPieChart = () => {
    if (!data || data.moodDistribution.length === 0) return null

    const size = 120
    const center = size / 2
    const radius = 40

    let cumulativeAngle = 0

    const paths = data.moodDistribution.map((mood) => {
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
        <path key={mood.moodKey} d={pathData} fill={mood.color} stroke="white" strokeWidth="1" />
      )
    })

    return (
      <div className="flex items-center justify-center">
        <svg width={size} height={size} className="drop-shadow-sm">
          {paths}
          <circle cx={center} cy={center} r={20} fill="white" stroke="#e5e7eb" strokeWidth="1" />
          <text
            x={center}
            y={center}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xs font-semibold"
          >
            {data.avgMoodScore.toFixed(1)}
          </text>
        </svg>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 gap-6">
            <div className="h-48 bg-muted rounded"></div>
            <div className="h-48 bg-muted rounded"></div>
          </div>
          <div className="h-32 bg-muted rounded mt-6"></div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <PieChart className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg">暂无数据</p>
        <p className="text-sm">这个月还没有足够的记录</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">
          {year}年{month}月
        </h2>
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <CalendarIcon className="w-4 h-4" />
            <span>
              {data.recordedDays}/{data.totalDays}天
            </span>
          </div>
          {data.dominantMood && (
            <div className="flex items-center gap-1">
              <span>{getMoodEmoji(data.dominantMood)}</span>
              <span>{getMoodLabel(data.dominantMood)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">情绪分布</h3>
          </div>
          <div className="space-y-4">
            {renderMoodPieChart()}
            <div className="space-y-2">
              {data.moodDistribution.slice(0, 5).map(mood => (
                <div key={mood.moodKey} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: mood.color }}
                    ></div>
                    <span>{getMoodEmoji(mood.moodKey)}</span>
                    <span>{getMoodLabel(mood.moodKey)}</span>
                  </div>
                  <span className="text-muted-foreground">{mood.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border shadow-sm p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Hash className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">热门标签</h3>
          </div>
          {data.topTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {data.topTags.slice(0, 10).map((tag, index) => {
                const sizes = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl']
                const size = sizes[Math.min(index, sizes.length - 1)]
                return (
                  <span
                    key={tag.tag}
                    className={`inline-block px-3 py-1 bg-primary/10 text-primary rounded-full ${size} font-medium`}
                  >
                    {tag.tag}
                  </span>
                )
              })}
            </div>
          ) : (
            <div className="text-center flex-1 flex flex-col justify-center items-center text-muted-foreground">
              <Hash className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无标签数据</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-card rounded-lg border shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">月度概览</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary mb-1">{data.recordedDays}</div>
            <div className="text-xs text-muted-foreground">记录天数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500 mb-1">
              {data.moodDistribution.length}
            </div>
            <div className="text-xs text-muted-foreground">情绪种类</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-500 mb-1">{data.topTags.length}</div>
            <div className="text-xs text-muted-foreground">使用标签</div>
          </div>
        </div>
      </div>
    </div>
  )
}
