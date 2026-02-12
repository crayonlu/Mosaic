import { useThemeStore } from '@/stores/theme-store'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Calendar, Check, X } from 'lucide-react-native'
import { useState } from 'react'
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

interface ArchiveDateFilterProps {
  selectedDate?: string
  onDateSelect: (date?: string) => void
  isArchiveMode: boolean
  hasSelection: boolean
  onArchivePress: () => void
}

export function ArchiveDateFilter({
  selectedDate,
  onDateSelect,
  isArchiveMode,
  hasSelection,
  onArchivePress,
}: ArchiveDateFilterProps) {
  const { theme } = useThemeStore()
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [tempDate, setTempDate] = useState<Date>(selectedDate ? new Date(selectedDate) : new Date())

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  const onDateChange = (event: { type: string }, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios')
    if (date && event.type !== 'dismissed') {
      const dateString = date.toISOString().split('T')[0]
      setTempDate(date)
      onDateSelect(dateString)
    }
  }

  const handleClearDate = () => {
    onDateSelect(undefined)
  }

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            {
              backgroundColor: theme.surface,
              borderColor: selectedDate ? theme.primary : theme.border,
            },
          ]}
          onPress={() => setShowDatePicker(true)}
        >
          <Calendar size={18} color={selectedDate ? theme.primary : theme.textSecondary} />
          <Text
            style={[
              styles.filterText,
              { color: selectedDate ? theme.primary : theme.textSecondary },
            ]}
          >
            {formatDate(selectedDate) || '选择日期'}
          </Text>
          {selectedDate && (
            <TouchableOpacity
              onPress={handleClearDate}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.archiveButton,
            { backgroundColor: hasSelection ? theme.primary : theme.surface },
            { borderColor: hasSelection ? theme.primary : theme.border },
          ]}
          onPress={onArchivePress}
        >
          {hasSelection ? (
            <Check size={18} color="#FFFFFF" />
          ) : isArchiveMode ? (
            <X size={18} color={theme.textSecondary} />
          ) : null}
          <Text
            style={[
              styles.archiveButtonText,
              { color: hasSelection ? '#FFFFFF' : theme.textSecondary },
            ]}
          >
            {hasSelection ? '确定' : isArchiveMode ? '取消' : '归档'}
          </Text>
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          onChange={onDateChange}
          maximumDate={new Date()}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    flex: 1,
  },
  filterText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  archiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  archiveButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
})
