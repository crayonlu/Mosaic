import { MoodHeatMap } from '@/components/common/MoodHeatMap'
import { useHeatmapQuery } from '@/stores/statsStore'
import { MOODS } from '@mosaic/utils'

function HeatMapSkeleton() {
  return (
    <div className="p-3 rounded-xl border bg-card/70 space-y-3">
      <div className="text-xs font-medium text-muted-foreground">心情热力图</div>
      <div className="w-full overflow-hidden rounded-xl border py-2" style={{ minHeight: 122 }}>
        <div className="mx-auto flex w-fit gap-1.5 justify-start px-2">
          {Array.from({ length: 18 }).map((_, wi) => (
            <div key={wi} className="flex flex-col gap-1.5">
              {Array.from({ length: 7 }).map((_, di) => (
                <div key={di} className="h-2.5 w-2.5 rounded-sm animate-pulse bg-muted" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-x-2 gap-y-1">
        {MOODS.map(mood => (
          <div key={mood.key} className="flex items-center gap-1.5 min-w-0">
            <div className="w-2 h-2 rounded-full shrink-0 animate-pulse bg-muted" />
            <div className="h-2 w-6 rounded animate-pulse bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SidebarHeatMap() {
  const { data: heatmapData, isLoading: heatmapLoading } = useHeatmapQuery()

  if (heatmapLoading) {
    return <HeatMapSkeleton />
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
