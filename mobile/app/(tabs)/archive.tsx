/**
 * Archive Tab - History & Timeline View
 */

import { CalendarPicker } from '@/components/archive/CalendarPicker'
import { MemoFeed } from '@/components/archive/MemoFeed'
import { MoodHeatMap } from '@/components/archive/MoodHeatMap'
import { useThemeStore } from '@/stores/theme-store'
import type { MemoWithResources } from '@/types/memo'
import { router } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

export default function ArchiveScreen() {
  const { theme } = useThemeStore()
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined)

  const handleDateSelect = (date: string) => {
    setSelectedDate(date)
  }

  const handleDateClick = (date: string) => {
    handleDateSelect(date)
  }

  const handleMemoPress = (memo: MemoWithResources) => {
    router.push({ pathname: '/memo/[id]', params: { id: memo.id } })
  }

  const handleMemoArchive = (id: string) => {
    console.log('Archive memo:', id)
  }

  const handleMemoDelete = (id: string) => {
    console.log('Delete memo:', id)
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
                <Text style={[styles.sectionTitle, { color: theme.text }]}>情绪热力图</Text>
              </View>
              <View style={styles.sectionContent}>
                <MoodHeatMap onDateClick={handleDateClick} />
              </View>
            </View>

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
