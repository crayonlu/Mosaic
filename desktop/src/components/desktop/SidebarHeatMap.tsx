import { MoodHeatMap } from '@/components/common/MoodHeatMap'
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
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(45, 70%, 70%)' }} />
          <span>愉悦</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(0, 70%, 70%)' }} />
          <span>愤怒</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(210, 70%, 70%)' }} />
          <span>悲伤</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(180, 70%, 70%)' }} />
          <span>平静</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(25, 70%, 70%)' }} />
          <span>焦虑</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(160, 70%, 70%)' }} />
          <span>专注</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(195, 70%, 70%)' }} />
          <span>疲惫</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(0, 0%, 70%)' }} />
          <span>中性</span>
        </div>
      </div>
    </div>
  )
}
