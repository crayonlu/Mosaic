import { useThemeStore } from '@/stores/theme-store'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Calendar, X } from 'lucide-react-native'
import { useState } from 'react'
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

interface ArchiveDateFilterProps {
  selectedDate?: string
  onDateSelect: (date?: string) => void
}

export function ArchiveDateFilter({ selectedDate, onDateSelect }: ArchiveDateFilterProps) {
  const { theme } = useThemeStore()
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [tempDate, setTempDate] = useState<Date>(selectedDate ? new Date(selectedDate) : new Date())

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  const onDateChange = (event: { type: string }, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios')
    if (selectedDate && event.type !== 'dismissed') {
      const dateString = selectedDate.toISOString().split('T')[0]
      setTempDate(selectedDate)
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
            { backgroundColor: theme.surface, borderColor: selectedDate ? theme.primary : theme.border },
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
            <TouchableOpacity onPress={handleClearDate} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
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
    marginBottom: 16,
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
})
