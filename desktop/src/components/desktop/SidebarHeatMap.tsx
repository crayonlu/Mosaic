import { MoodHeatMap } from '@/components/common/MoodHeatMap'
import { useHeatmapQuery } from '@/stores/statsStore'
import { MOODS } from '@mosaic/utils'

export function SidebarHeatMap() {
  const { data: heatmapData, isLoading: heatmapLoading } = useHeatmapQuery()
  if (heatmapLoading) {
    return (
      <div className="p-3 rounded-xl border bg-card/70">
        <div className="text-xs font-medium text-muted-foreground mb-2">心情热力图</div>
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
    <div className="p-3 rounded-xl border bg-card/70 space-y-3">
      <div className="text-xs font-medium text-muted-foreground">心情热力图</div>
      <div>
        <MoodHeatMap data={heatmapData} onDateClick={() => {}} />
      </div>
      <div className="grid grid-cols-4 gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
        {MOODS.map(mood => (
          <div key={mood.key} className="flex items-center gap-1.5 min-w-0">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: mood.color }}
            />
            <span>{mood.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
