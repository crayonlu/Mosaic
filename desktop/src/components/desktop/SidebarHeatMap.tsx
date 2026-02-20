import { MoodHeatMap } from '@/components/common/MoodHeatMap'
import { MOODS } from '@mosaic/utils'
import { useHeatmapQuery } from '@/stores/stats-store'

export function SidebarHeatMap() {
  const { data: heatmapData, isLoading: heatmapLoading } = useHeatmapQuery()
  if (heatmapLoading) {
    return (
      <div className="p-2">
        <div className="text-xs text-muted-foreground mb-2">心情热力图</div>
        <div className="flex items-center justify-center h-16">
          <div className="text-xs text-muted-foreground">加载中...</div>
        </div>
      </div>
    )
  }

  if (!heatmapData) {
    return null
  }

  return (
    <div className="p-2">
      <div className="text-xs text-muted-foreground mb-2">心情热力图</div>
      <div className="overflow-x-auto">
        <MoodHeatMap data={heatmapData} onDateClick={() => {}} />
      </div>
      <div className="flex flex-wrap gap-1 mt-2 text-[10px] text-muted-foreground">
        {MOODS.map(mood => (
          <div key={mood.key} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: mood.color }} />
            <span>{mood.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
