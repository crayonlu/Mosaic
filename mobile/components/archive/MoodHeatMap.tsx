import { useThemeStore } from '@/stores/themeStore'
import { useHeatmap } from '@/lib/query'
import { MOODS, getMoodColor } from '@mosaic/utils'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
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

function HeatMapSkeleton() {
  const { theme } = useThemeStore()
  const opacity = useSharedValue(1)

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.35, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
      false
    )
  }, [opacity])

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  const skeletonColor = theme.surfaceStrong

  return (
    <View style={styles.container}>
      <View style={styles.scrollContent}>
        <Animated.View style={[styles.heatMapGrid, animStyle]}>
          {Array.from({ length: 26 }).map((_, wi) => (
            <View key={wi} style={styles.weekRow}>
              {Array.from({ length: 7 }).map((_, di) => (
                <View
                  key={di}
                  style={[
                    styles.cell,
                    { backgroundColor: skeletonColor, borderColor: 'transparent' },
                  ]}
                />
              ))}
            </View>
          ))}
        </Animated.View>
      </View>
      <View style={[styles.legend]}>
        <Animated.View
          style={[
            { width: 56, height: 12, borderRadius: 4, backgroundColor: skeletonColor },
            animStyle,
          ]}
        />
        <View style={styles.legendScrollContent}>
          <View style={styles.legendItems}>
            {MOODS.map(item => (
              <View key={item.key} style={styles.legendItem}>
                <Animated.View
                  style={[styles.legendColor, { backgroundColor: skeletonColor }, animStyle]}
                />
                <Animated.View
                  style={[
                    { width: 24, height: 10, borderRadius: 3, backgroundColor: skeletonColor },
                    animStyle,
                  ]}
                />
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  )
}

export function MoodHeatMap({ onDateClick }: MoodHeatMapProps) {
  const { theme } = useThemeStore()
  const { data: heatmapData, isLoading: loading } = useHeatmap()
  const scrollViewRef = useRef<ScrollView>(null)

  const moodLegend = useMemo(() => MOODS, [])

  const getLocalMoodColor = useCallback(
    (moodKey?: string | null) => {
      return getMoodColor(moodKey) || theme.border
    },
    [theme.border]
  )

  // Process API response into display cells
  const data = useMemo(() => {
    if (!heatmapData) return null

    const startDateStr = dayjs().subtract(6, 'month').format('YYYY-MM-DD')
    const endDateStr = dayjs().format('YYYY-MM-DD')

    const dateInfoMap = new Map<string, { count: number; moodKey?: string }>()
    heatmapData.dates.forEach((date, index) => {
      const moodKey =
        (heatmapData.moods?.[index] ?? heatmapData.moodScores?.[index] !== undefined)
          ? (heatmapData.moods?.[index] ?? undefined)
          : undefined
      dateInfoMap.set(date, {
        count: heatmapData.counts[index],
        moodKey: moodKey as string | undefined,
      })
    })

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

      let color = theme.border
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

    return {
      startDate: startDateStr,
      endDate: endDateStr,
      cells,
    }
  }, [heatmapData, theme.border, getLocalMoodColor])

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
    return <HeatMapSkeleton />
  }

  return (
    <View style={[styles.container]}>
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
                      borderColor: theme.border,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '500',
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
    borderWidth: StyleSheet.hairlineWidth,
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
