import { Loading } from '@/components/ui'
import { useThemeStore } from '@/stores/theme-store'
import { statsApi } from '@mosaic/api'
import { MOODS, getMoodColor } from '@mosaic/utils'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
interface HeatMapCell {
  date: string
  color: string
  moodKey?: string
  count?: number
  isToday?: boolean
}

interface HeatMapData {
  startDate: string
  endDate: string
  cells: HeatMapCell[]
}

interface MoodHeatMapProps {
  onDateClick?: (date: string) => void
}

export function MoodHeatMap({ onDateClick }: MoodHeatMapProps) {
  const { theme } = useThemeStore()
  const [data, setData] = useState<HeatMapData | null>(null)
  const [loading, setLoading] = useState(true)
  const scrollViewRef = useRef<ScrollView>(null)

  const moodLegend = useMemo(() => MOODS, [])

  const getLocalMoodColor = useCallback(
    (moodKey?: string | null) => {
      return getMoodColor(moodKey) || theme.border
    },
    [theme.border]
  )

  const loadHeatMapData = useCallback(async () => {
    try {
      setLoading(true)

      const endDate = new Date()
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - 6)

      const startDateStr = dayjs(startDate).format('YYYY-MM-DD')
      const endDateStr = dayjs(endDate).format('YYYY-MM-DD')
      const response = await statsApi.getHeatmap({
        startDate: startDateStr,
        endDate: endDateStr,
      })

      // Build a map of date to count and mood from API response
      const dateInfoMap = new Map<string, { count: number; moodKey?: string }>()
      response.dates.forEach((date, index) => {
        const moodKey =
          (response.moods?.[index] ?? response.moodScores?.[index] !== undefined)
            ? (response.moods?.[index] ?? undefined)
            : undefined
        dateInfoMap.set(date, {
          count: response.counts[index],
          moodKey: moodKey as string | undefined,
        })
      })

      // Build complete cells array for each day in the range
      const cells: HeatMapCell[] = []
      const start = dayjs(startDateStr)
      const end = dayjs(endDateStr)
      const today = dayjs().format('YYYY-MM-DD')

      let current = start
      while (current.isBefore(end) || current.isSame(end, 'day')) {
        const dateStr = current.format('YYYY-MM-DD')
        const info = dateInfoMap.get(dateStr)
        const count = info?.count || 0
        const moodKey = info?.moodKey

        // Calculate color based on mood
        let color = theme.border // default empty color
        if (count > 0) {
          color = getLocalMoodColor(moodKey)
        }

        cells.push({
          date: dateStr,
          count,
          color,
          moodKey,
          isToday: dateStr === today,
        })

        current = current.add(1, 'day')
      }

      setData({
        startDate: startDateStr,
        endDate: endDateStr,
        cells,
      })
    } catch (error) {
      console.error('Failed to load heat map data:', error)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [theme.border, getLocalMoodColor])

  useEffect(() => {
    loadHeatMapData()
  }, [loadHeatMapData])

  // Scroll to end (today) after data loads
  useEffect(() => {
    if (data && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false })
      }, 100)
    }
  }, [data])

  // Group cells by weeks
  const weeks = useMemo(() => {
    if (!data) return []

    const cells = data.cells
    const weeks: HeatMapCell[][] = []

    // Find the first day of the range
    const firstDay = new Date(data.startDate)
    const startDayOfWeek = firstDay.getDay()

    // Add empty cells for days before the first day
    const firstWeek: HeatMapCell[] = []
    for (let i = 0; i < startDayOfWeek; i++) {
      firstWeek.push({
        date: '',
        color: 'transparent',
      })
    }

    // Add the first day
    firstWeek.push(cells[0])

    // Add remaining days of the first week
    for (let i = 1; i < 7 - startDayOfWeek && i < cells.length; i++) {
      firstWeek.push(cells[i])
    }

    weeks.push(firstWeek)

    // Add remaining weeks
    let cellIndex = 7 - startDayOfWeek
    while (cellIndex < cells.length) {
      const week: HeatMapCell[] = []
      for (let i = 0; i < 7 && cellIndex < cells.length; i++) {
        week.push(cells[cellIndex])
        cellIndex++
      }
      weeks.push(week)
    }

    return weeks
  }, [data])

  // Handle date click
  const handleDateClick = (cell: HeatMapCell) => {
    if (cell.date && onDateClick) {
      onDateClick(cell.date)
    }
  }

  if (loading) {
    return (
      <View
        style={[styles.container, { backgroundColor: 'transparent', borderColor: theme.border }]}
      >
        <Loading text="加载中..." />
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Heat map grid */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.heatMapGrid}>
          {weeks.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.weekRow}>
              {week.map((cell, dayIndex) => (
                <TouchableOpacity
                  key={dayIndex}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: cell.color === 'transparent' ? 'transparent' : cell.color,
                    },
                  ]}
                  onPress={() => handleDateClick(cell)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Legend */}
      <View style={[styles.legend]}>
        <Text style={[styles.legendText, { color: theme.textSecondary }]}>情绪热力图</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.legendScrollContent}
        >
          <View style={styles.legendItems}>
            {moodLegend.map(item => (
              <View key={item.key} style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                <Text style={[styles.legendItemText, { color: theme.textSecondary }]}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    paddingVertical: 4,
  },
  heatMapGrid: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
  },
  weekRow: {
    gap: 4,
  },
  cell: {
    width: 14,
    height: 14,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  legendScrollContent: {
    paddingLeft: 12,
  },
  legendItems: {
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendItemText: {
    fontSize: 11,
  },
})
