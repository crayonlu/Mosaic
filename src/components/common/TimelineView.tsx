import { useState, useEffect } from 'react'
import { Calendar, Heart, FileText } from 'lucide-react'
import { statsCommands } from '@/utils/callRust'
import { getMoodEmoji } from '@/utils/moodEmoji'
import type { TimelineData, TimelineQuery, TimelineEntry } from '@/types/stats'

interface TimelineViewProps {
  startDate: string
  endDate: string
}

export function TimelineView({ startDate, endDate }: TimelineViewProps) {
  const [data, setData] = useState<TimelineData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadTimelineData()
  }, [startDate, endDate])

  const loadTimelineData = async () => {
    try {
      setIsLoading(true)
      const query: TimelineQuery = { startDate, endDate }
      const timelineData = await statsCommands.getTimeline(query)
      setData(timelineData)
    } catch (error) {
      console.error('Failed to load timeline data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 bg-muted rounded-full"></div>
              <div className="w-0.5 h-16 bg-muted mt-2"></div>
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-1/4"></div>
              <div className="h-16 bg-muted rounded"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!data || data.entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Calendar className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg">暂无时间线数据</p>
        <p className="text-sm">记录一些日记来查看你的情绪时间线</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">情绪时间线</h2>
        <p className="text-sm text-muted-foreground">{data.entries.length} 天的记录</p>
      </div>

      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/20 via-primary/40 to-primary/20"></div>

        <div className="space-y-6">
          {data.entries.map((entry, index) => (
            <div key={entry.date} className="relative flex gap-6">
              <div className="flex flex-col items-center z-10">
                <div
                  className="w-4 h-4 rounded-full border-2 border-background shadow-sm"
                  style={{ backgroundColor: entry.color }}
                ></div>
                {index < data.entries.length - 1 && (
                  <div className="w-0.5 flex-1 bg-primary/20 mt-2"></div>
                )}
              </div>

              <div className="flex-1">
                <div className="bg-card rounded-lg border shadow-sm p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="font-medium">{formatDate(entry.date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {entry.moodKey && (
                        <>
                          <span className="text-lg">{getMoodEmoji(entry.moodKey)}</span>
                          <span className="text-xs bg-muted px-2 py-1 rounded-full">
                            {entry.moodScore}
                          </span>
                        </>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FileText className="w-3 h-3" />
                        <span>{entry.memoCount}</span>
                      </div>
                    </div>
                  </div>

                  {entry.summary && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{entry.summary}</p>
                  )}

                  {!entry.summary && entry.memoCount > 0 && (
                    <p className="text-sm text-muted-foreground italic">{entry.memoCount} 条记录</p>
                  )}

                  {!entry.summary && entry.memoCount === 0 && (
                    <p className="text-sm text-muted-foreground italic">今日无记录</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
