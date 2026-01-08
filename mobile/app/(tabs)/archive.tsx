/**
 * Archive Tab - History & Timeline View
 */

import { CalendarPicker } from '@/components/archive/CalendarPicker'
import { MemoFeed } from '@/components/archive/MemoFeed'
import { MoodHeatMap } from '@/components/archive/MoodHeatMap'
import { useThemeStore } from '@/stores/theme-store'
import type { MemoWithResources } from '@/types/memo'
import { router } from 'expo-router'
import { ChevronDown, ChevronUp } from 'lucide-react-native'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export default function ArchiveScreen() {
  const { theme } = useThemeStore()
  const [isHeatMapExpanded, setIsHeatMapExpanded] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined)

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

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
            <Text style={[styles.sectionTitle, { color: theme.text }]}>情绪热力图</Text>
            {isHeatMapExpanded ? (
              <ChevronUp size={20} color={theme.textSecondary} strokeWidth={2} />
            ) : (
              <ChevronDown size={20} color={theme.textSecondary} strokeWidth={2} />
            )}
          </TouchableOpacity>

          {isHeatMapExpanded && (
            <View style={styles.sectionContent}>
              <MoodHeatMap onDateClick={handleDateClick} />
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

        {/* Memo Feed Section */}
        <View style={styles.feedSection}>
          <MemoFeed
            targetDate={selectedDate}
            onMemoPress={handleMemoPress}
            onMemoArchive={handleMemoArchive}
            onMemoDelete={handleMemoDelete}
          />
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionContent: {
    padding: 16,
  },
  feedSection: {
    flex: 1,
  },
})
