import { DatePickerSheet } from '@/components/ui'
import { useThemeStore } from '@/stores/themeStore'
import dayjs from 'dayjs'
import { Calendar, X } from 'lucide-react-native'
import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

interface ArchiveDateFilterProps {
  selectedDate?: string
  onDateSelect: (date?: string) => void
}

export function ArchiveDateFilter({ selectedDate, onDateSelect }: ArchiveDateFilterProps) {
  const { theme } = useThemeStore()
  const [showDatePicker, setShowDatePicker] = useState(false)

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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
              backgroundColor: theme.surfaceMuted,
              borderColor: 'transparent',
              borderRadius: theme.radius.medium,
            },
          ]}
          onPress={() => setShowDatePicker(true)}
        >
          <Calendar size={18} color={theme.textSecondary} />
          <Text
            style={[
              styles.filterText,
              { color: selectedDate ? theme.text : theme.textSecondary },
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
      </View>

      <DatePickerSheet
        visible={showDatePicker}
        selectedDate={selectedDate}
        maxDate={dayjs().format('YYYY-MM-DD')}
        onSelect={onDateSelect}
        onClear={handleClearDate}
        onClose={() => setShowDatePicker(false)}
        title="选择归档日期"
      />
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    flex: 1,
  },
  filterText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
})
