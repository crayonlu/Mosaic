import { useThemeStore } from '@/stores/themeStore'
import dayjs, { Dayjs } from 'dayjs'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

interface DatePickerSheetProps {
  visible: boolean
  selectedDate?: string
  onSelect: (date: string) => void
  onClose: () => void
  onClear?: () => void
  title?: string
  minDate?: string
  maxDate?: string
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export function DatePickerSheet({
  visible,
  selectedDate,
  onSelect,
  onClose,
  onClear,
  title = '选择日期',
  minDate,
  maxDate,
}: DatePickerSheetProps) {
  const { theme } = useThemeStore()
  const [monthCursor, setMonthCursor] = useState(dayjs().startOf('month'))

  useEffect(() => {
    if (visible) {
      const anchor = selectedDate ? dayjs(selectedDate) : dayjs()
      setMonthCursor(anchor.startOf('month'))
    }
  }, [visible, selectedDate])

  const min = useMemo(() => (minDate ? dayjs(minDate) : null), [minDate])
  const max = useMemo(() => (maxDate ? dayjs(maxDate) : null), [maxDate])

  const calendarCells = useMemo(() => {
    const startOfMonth = monthCursor.startOf('month')
    const daysInMonth = monthCursor.daysInMonth()
    const leading = (startOfMonth.day() + 6) % 7
    const total = Math.ceil((leading + daysInMonth) / 7) * 7

    return Array.from({ length: total }, (_, index) => {
      const dayNumber = index - leading + 1
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        return null
      }
      return monthCursor.date(dayNumber)
    })
  }, [monthCursor])

  const isDisabled = (date: Dayjs) => {
    if (min && date.isBefore(min, 'day')) {
      return true
    }
    if (max && date.isAfter(max, 'day')) {
      return true
    }
    return false
  }

  const quickSelect = (offsetDays: number) => {
    const date = dayjs().add(offsetDays, 'day')
    if (!isDisabled(date)) {
      onSelect(date.format('YYYY-MM-DD'))
      onClose()
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.monthButton, { backgroundColor: theme.surfaceMuted }]}
                onPress={() => setMonthCursor(prev => prev.subtract(1, 'month'))}
                activeOpacity={theme.state.pressedOpacity}
              >
                <ChevronLeft size={16} color={theme.textSecondary} />
              </TouchableOpacity>
              <Text style={[styles.monthText, { color: theme.text }]}>
                {monthCursor.format('YYYY 年 M 月')}
              </Text>
              <TouchableOpacity
                style={[styles.monthButton, { backgroundColor: theme.surfaceMuted }]}
                onPress={() => setMonthCursor(prev => prev.add(1, 'month'))}
                activeOpacity={theme.state.pressedOpacity}
              >
                <ChevronRight size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAY_LABELS.map(label => (
              <Text key={label} style={[styles.weekLabel, { color: theme.textSecondary }]}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {calendarCells.map((cell, index) => {
              if (!cell) {
                return <View key={`blank-${index}`} style={styles.cell} />
              }

              const disabled = isDisabled(cell)
              const selected = Boolean(selectedDate) && cell.format('YYYY-MM-DD') === selectedDate

              return (
                <TouchableOpacity
                  key={cell.format('YYYY-MM-DD')}
                  style={[
                    styles.cell,
                    styles.dateCell,
                    {
                      backgroundColor: selected ? theme.surfaceStrong : 'transparent',
                      borderColor: selected ? theme.border : 'transparent',
                      borderWidth: selected ? StyleSheet.hairlineWidth : 0,
                      opacity: disabled ? theme.state.disabledOpacity : 1,
                    },
                  ]}
                  onPress={() => {
                    if (disabled) return
                    onSelect(cell.format('YYYY-MM-DD'))
                    onClose()
                  }}
                  activeOpacity={theme.state.pressedOpacity}
                  disabled={disabled}
                >
                  <Text
                    style={[
                      styles.dateText,
                      {
                        color: theme.text,
                        fontWeight: selected ? '500' : '400',
                      },
                    ]}
                  >
                    {cell.date()}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <View style={styles.quickRow}>
            <TouchableOpacity
              style={[styles.quickButton, { backgroundColor: theme.surfaceMuted }]}
              onPress={() => quickSelect(0)}
              activeOpacity={theme.state.pressedOpacity}
            >
              <Text style={[styles.quickButtonText, { color: theme.text }]}>今天</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickButton, { backgroundColor: theme.surfaceMuted }]}
              onPress={() => quickSelect(-1)}
              activeOpacity={theme.state.pressedOpacity}
            >
              <Text style={[styles.quickButtonText, { color: theme.text }]}>昨天</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickButton, { backgroundColor: theme.surfaceMuted }]}
              onPress={() => {
                onClear?.()
                onClose()
              }}
              activeOpacity={theme.state.pressedOpacity}
            >
              <Text style={[styles.quickButtonText, { color: theme.textSecondary }]}>清空</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.24)',
  },
  sheet: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    gap: 10,
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthText: {
    fontSize: 15,
    fontWeight: '500',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekLabel: {
    width: '14.2857%',
    textAlign: 'center',
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  cell: {
    width: '14.2857%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCell: {
    borderRadius: 12,
  },
  dateText: {
    fontSize: 14,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
})
