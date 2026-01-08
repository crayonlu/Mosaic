import { Loading } from '@/components/ui'
import { TimeRanges, type TimeRangeValue } from '@/constants/common'
import { statsService } from '@/lib/services/stats-service'
import { useDatabaseStore } from '@/lib/database/state-manager'
import { useThemeStore } from '@/stores/theme-store'
import type { HeatMapCell, HeatMapData } from '@/types/stats'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

interface MoodHeatMapProps {
  onDateClick?: (date: string) => void
  timeRange?: TimeRangeValue
  onTimeRangeChange?: (range: TimeRangeValue) => void
}

export function MoodHeatMap({
  onDateClick,
  timeRange = 'quarter',
  onTimeRangeChange,
}: MoodHeatMapProps) {
  const { theme } = useThemeStore()
  const { isReady: dbReady, isInitializing: dbInitializing, error: dbError } = useDatabaseStore()
  const [data, setData] = useState<HeatMapData | null>(null)
  const [loading, setLoading] = useState(true)

  // Mood legend with all 8 emotions
  const moodLegend = useMemo(
    () => [
      { key: 'joy', label: '愉悦', color: '#FFD93D' },
      { key: 'anger', label: '愤怒', color: '#FF6B6B' },
      { key: 'sadness', label: '悲伤', color: '#4ECDC4' },
      { key: 'calm', label: '平静', color: '#95E1D3' },
      { key: 'anxiety', label: '焦虑', color: '#FFA07A' },
      { key: 'focus', label: '专注', color: '#6C5CE7' },
      { key: 'tired', label: '疲惫', color: '#A8A8A8' },
      { key: 'neutral', label: '中性', color: theme.border },
    ],
    [theme.border]
  )

  // Load heat map data
  const loadHeatMapData = useCallback(async () => {
    try {
      setLoading(true)

      // Check database readiness
      if (!dbReady) {
        console.warn('[MoodHeatMap] Database not ready, skipping load')
        setLoading(false)
        return
      }

      const endDate = new Date()
      const startDate = new Date()

      // Get months based on timeRange value
      let months = 3 // default to quarter
      if (timeRange === 'year') {
        months = 12
      } else if (timeRange === 'half') {
        months = 6
      } else if (timeRange === 'quarter') {
        months = 3
      }

      startDate.setMonth(startDate.getMonth() - months)

      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]

      console.log(
        '[MoodHeatMap] Loading data for range:',
        startDateStr,
        'to',
        endDateStr,
        'months:',
        months
      )

      const heatMapData = await statsService.getHeatMapData({
        startDate: startDateStr,
        endDate: endDateStr,
      })

      console.log('[MoodHeatMap] Data loaded successfully:', heatMapData.cells.length, 'cells')
      setData(heatMapData)
    } catch (error) {
      console.error('[MoodHeatMap] Failed to load heat map data:', error)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [timeRange, dbReady])

  useEffect(() => {
    if (dbReady) {
      loadHeatMapData()
    }
  }, [dbReady])

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

  if (dbInitializing || loading) {
    return (
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
        <Loading text="加载中..." />
      </View>
    )
  }

  if (dbError) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <Text style={[styles.headerText, { color: theme.text }]}>数据库错误</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* Heat map grid */}
      <ScrollView
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
      <View style={[styles.legend, { borderTopColor: theme.border }]}>
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
    paddingVertical: 10,
  },
  heatMapGrid: {
    flexDirection: 'row',
    gap: 4,
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
    borderTopWidth: 1,
    marginTop: 8,
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
