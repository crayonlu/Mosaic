import { useThemeStore } from '@/stores/theme-store'
import { useMemo, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

interface CalendarPickerProps {
  selectedDate?: string
  onDateSelect?: (date: string) => void
  onMonthChange?: (year: number, month: number) => void
}

export function CalendarPicker({ selectedDate, onDateSelect, onMonthChange }: CalendarPickerProps) {
  const { theme } = useThemeStore()
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())

  // Get days in month
  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate()
  }, [currentYear, currentMonth])

  // Get first day of month (0 = Sunday, 1 = Monday, etc.)
  const firstDayOfMonth = useMemo(() => {
    return new Date(currentYear, currentMonth, 1).getDay()
  }, [currentYear, currentMonth])

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days: (number | null)[] = []

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null)
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }

    return days
  }, [firstDayOfMonth, daysInMonth])

  // Handle month navigation
  const handlePreviousMonth = () => {
    let newMonth = currentMonth - 1
    let newYear = currentYear

    if (newMonth < 0) {
      newMonth = 11
      newYear = currentYear - 1
    }

    setCurrentMonth(newMonth)
    setCurrentYear(newYear)
    onMonthChange?.(newYear, newMonth)
  }

  const handleNextMonth = () => {
    let newMonth = currentMonth + 1
    let newYear = currentYear

    if (newMonth > 11) {
      newMonth = 0
      newYear = currentYear + 1
    }

    setCurrentMonth(newMonth)
    setCurrentYear(newYear)
    onMonthChange?.(newYear, newMonth)
  }

  // Handle date selection
  const handleDatePress = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    onDateSelect?.(dateStr)
  }

  // Check if a date is selected
  const isDateSelected = (day: number): boolean => {
    if (!selectedDate) return false
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return dateStr === selectedDate
  }

  // Check if a date is today
  const isToday = (day: number): boolean => {
    const today = new Date()
    return (
      today.getFullYear() === currentYear &&
      today.getMonth() === currentMonth &&
      today.getDate() === day
    )
  }

  // Get month label
  const monthLabel = `${currentYear}年${currentMonth + 1}月`

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={handlePreviousMonth}
          style={styles.monthButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.monthButtonText, { color: theme.primary }]}>◀</Text>
        </TouchableOpacity>
        <Text style={[styles.headerText, { color: theme.text }]}>{monthLabel}</Text>
        <TouchableOpacity
          onPress={handleNextMonth}
          style={styles.monthButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.monthButtonText, { color: theme.primary }]}>▶</Text>
        </TouchableOpacity>
      </View>

      {/* Week day labels */}
      <View style={[styles.weekDays, { borderBottomColor: theme.border }]}>
        {['日', '一', '二', '三', '四', '五', '六'].map((day, index) => (
          <View key={index} style={styles.weekDay}>
            <Text style={[styles.weekDayText, { color: theme.textSecondary }]}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.scrollContent}>
        <View style={styles.calendarGrid}>
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <View key={index} style={styles.dayCell} />
            }

            const selected = isDateSelected(day)
            const today = isToday(day)

            return (
              <TouchableOpacity
                key={index}
                onPress={() => handleDatePress(day)}
                style={[
                  styles.dayCell,
                  styles.dayCellActive,
                  selected && {
                    backgroundColor: theme.primary,
                    borderColor: theme.primary,
                  },
                  today &&
                    !selected && {
                      borderColor: theme.primary,
                      borderWidth: 2,
                    },
                ]}
                hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
              >
                <Text
                  style={[
                    styles.dayText,
                    selected && { color: '#FFFFFF' },
                    !selected && { color: theme.text },
                  ]}
                >
                  {day}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
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
  monthButton: {
    padding: 8,
  },
  monthButtonText: {
    fontSize: 18,
  },
  weekDays: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '500',
  },
  scrollContent: {
    paddingVertical: 10,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayCellActive: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
  },
})
