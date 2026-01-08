/**
 * Archive Tab - History & Timeline View
 */

import { CalendarPicker } from '@/components/archive/CalendarPicker'
import { MemoFeed } from '@/components/archive/MemoFeed'
import { MoodHeatMap } from '@/components/archive/MoodHeatMap'
import { Select } from '@/components/ui/Select'
import { TimeRanges, type TimeRangeValue } from '@/constants/common'
import { useThemeStore } from '@/stores/theme-store'
import type { MemoWithResources } from '@/types/memo'
import { router } from 'expo-router'
import { ChevronDown, ChevronUp } from 'lucide-react-native'
import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export default function ArchiveScreen() {
  const { theme } = useThemeStore()
  const [isHeatMapExpanded, setIsHeatMapExpanded] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined)
  const [timeRange, setTimeRange] = useState<TimeRangeValue>('quarter')

  // Handle date selection from calendar
  const handleDateSelect = (date: string) => {
    setSelectedDate(date)
    // Scroll to the memo for this date
    setTimeout(() => {
      // Find and scroll to the memo
      console.log('Scrolling to date:', date)
    }, 100)
  }

  // Handle date click from heat map
  const handleDateClick = (date: string) => {
    handleDateSelect(date)
  }

  // Handle memo press
  const handleMemoPress = (memo: MemoWithResources) => {
    router.push({ pathname: '/memo/[id]', params: { id: memo.id } })
  }

  // Handle memo archive
  const handleMemoArchive = (id: string) => {
    console.log('Archive memo:', id)
  }

  // Handle memo delete
  const handleMemoDelete = (id: string) => {
    console.log('Delete memo:', id)
  }

  // Toggle heat map
  const toggleHeatMap = () => {
    setIsHeatMapExpanded(!isHeatMapExpanded)
  }

  // Handle time range change
  const handleTimeRangeChange = (range: string) => {
    setTimeRange(range as TimeRangeValue)
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <MemoFeed
        targetDate={selectedDate}
        onMemoPress={handleMemoPress}
        onMemoArchive={handleMemoArchive}
        onMemoDelete={handleMemoDelete}
        headerComponent={
          <>
            {/* Heat Map Section */}
            <View
              style={[
                styles.section,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                },
              ]}
            >
              <TouchableOpacity
                onPress={toggleHeatMap}
                style={[
                  styles.sectionHeader,
                  {
                    borderBottomColor: theme.border,
                  },
                ]}
              >
                <View style={styles.headerLeft}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>情绪热力图</Text>
                  <Select
                    options={Object.values(TimeRanges).map(range => ({
                      label: range.label,
                      value: range.value,
                    }))}
                    value={timeRange}
                    onValueChange={handleTimeRangeChange}
                    size="small"
                  />
                </View>
                {isHeatMapExpanded ? (
                  <ChevronUp size={20} color={theme.textSecondary} strokeWidth={2} />
                ) : (
                  <ChevronDown size={20} color={theme.textSecondary} strokeWidth={2} />
                )}
              </TouchableOpacity>

              {isHeatMapExpanded && (
                <View style={styles.sectionContent}>
                  <MoodHeatMap
                    onDateClick={handleDateClick}
                    timeRange={timeRange}
                    onTimeRangeChange={handleTimeRangeChange}
                  />
                </View>
              )}
            </View>

            {/* Calendar Picker Section */}
            <View
              style={[
                styles.section,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                },
              ]}
            >
              <View
                style={[
                  styles.sectionHeader,
                  {
                    borderBottomColor: theme.border,
                  },
                ]}
              >
                <Text style={[styles.sectionTitle, { color: theme.text }]}>日历选择</Text>
              </View>
              <View style={styles.sectionContent}>
                <CalendarPicker
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  onMonthChange={(year, month) => {
                    console.log('Month changed:', year, month)
                  }}
                />
              </View>
            </View>
          </>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionContent: {
    padding: 16,
  },
})
