import { Badge } from '@/components/ui'
import { useThemeStore } from '@/stores/theme-store'
import DateTimePicker from '@react-native-community/datetimepicker'
import dayjs from 'dayjs'
import { Calendar, Filter, X } from 'lucide-react-native'
import { useState } from 'react'
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

interface SearchFiltersProps {
  selectedTags: string[]
  availableTags: string[]
  onTagsChange: (tags: string[]) => void
  startDate?: string
  endDate?: string
  onDateRangeChange?: (start?: string, end?: string) => void
  isArchived?: boolean
  onArchivedChange: (value?: boolean) => void
}

export function SearchFilters({
  selectedTags,
  availableTags,
  onTagsChange,
  startDate,
  endDate,
  onDateRangeChange,
  isArchived,
  onArchivedChange,
}: SearchFiltersProps) {
  const { theme } = useThemeStore()
  const [showFilters, setShowFilters] = useState(false)
  const [showStartDatePicker, setShowStartDatePicker] = useState(false)
  const [showEndDatePicker, setShowEndDatePicker] = useState(false)

  const [tempSelectedTags, setTempSelectedTags] = useState<string[]>(selectedTags)
  const [tempIsArchived, setTempIsArchived] = useState<boolean | undefined>(isArchived)
  const [tempStartDate, setTempStartDate] = useState<string | undefined>(startDate)
  const [tempEndDate, setTempEndDate] = useState<string | undefined>(endDate)

  const hasActiveFilters =
    selectedTags.length > 0 || startDate || endDate || isArchived !== undefined

  const handleOpenFilters = () => {
    setTempSelectedTags(selectedTags)
    setTempIsArchived(isArchived)
    setTempStartDate(startDate)
    setTempEndDate(endDate)
    setShowFilters(true)
  }

  const toggleTag = (tag: string) => {
    if (tempSelectedTags.includes(tag)) {
      setTempSelectedTags(tempSelectedTags.filter(t => t !== tag))
    } else {
      setTempSelectedTags([...tempSelectedTags, tag])
    }
  }

  const clearFilters = () => {
    setTempSelectedTags([])
    setTempStartDate(undefined)
    setTempEndDate(undefined)
    setTempIsArchived(undefined)
  }

  const handleApplyFilters = () => {
    onTagsChange(tempSelectedTags)
    onDateRangeChange?.(tempStartDate, tempEndDate)
    onArchivedChange(tempIsArchived)
    setShowFilters(false)
  }

  const handleCloseModal = () => {
    setShowFilters(false)
  }

  const archiveOptions = [
    { label: '全部', value: undefined },
    { label: '已归档', value: true },
    { label: '未归档', value: false },
  ]

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  const onStartDateChange = (event: { type: string }, selectedDate?: Date) => {
    setShowStartDatePicker(Platform.OS === 'ios')
    if (selectedDate && event.type !== 'dismissed') {
      const dateString = dayjs(selectedDate).format('YYYY-MM-DD')
      setTempStartDate(dateString)
    }
  }

  const onEndDateChange = (event: { type: string }, selectedDate?: Date) => {
    setShowEndDatePicker(Platform.OS === 'ios')
    if (selectedDate && event.type !== 'dismissed') {
      const dateString = dayjs(selectedDate).format('YYYY-MM-DD')
      setTempEndDate(dateString)
    }
  }

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            {
              backgroundColor: theme.surface,
              borderColor: hasActiveFilters ? theme.primary : theme.border,
            },
          ]}
          onPress={handleOpenFilters}
        >
          <Filter size={18} color={hasActiveFilters ? theme.primary : theme.textSecondary} />
          <Text
            style={[
              styles.filterText,
              { color: hasActiveFilters ? theme.primary : theme.textSecondary },
            ]}
          >
            筛选
          </Text>
          {hasActiveFilters && (
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <Text style={styles.badgeText}>
                {selectedTags.length +
                  (startDate || endDate ? 1 : 0) +
                  (isArchived !== undefined ? 1 : 0)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={showFilters}
        animationType="slide"
        transparent
        onRequestClose={handleCloseModal}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>筛选条件</Text>
              <TouchableOpacity onPress={handleCloseModal}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.filterSection}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>归档状态</Text>
                <View style={styles.archiveOptions}>
                  {archiveOptions.map(option => (
                    <TouchableOpacity
                      key={String(option.value)}
                      style={[
                        styles.archiveOption,
                        {
                          backgroundColor:
                            tempIsArchived === option.value ? theme.primary : theme.surface,
                          borderColor: theme.border,
                        },
                      ]}
                      onPress={() => setTempIsArchived(option.value as boolean | undefined)}
                    >
                      <Text
                        style={[
                          styles.archiveOptionText,
                          { color: tempIsArchived === option.value ? '#FFFFFF' : theme.text },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {availableTags.length > 0 && (
                <View style={styles.filterSection}>
                  <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>标签</Text>
                  <View style={styles.tagsContainer}>
                    {availableTags.map(tag => (
                      <TouchableOpacity key={tag} onPress={() => toggleTag(tag)}>
                        <Badge
                          text={tag}
                          variant={tempSelectedTags.includes(tag) ? 'solid' : 'outline'}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.filterSection}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>日期范围</Text>
                <View style={styles.dateRangeContainer}>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <Calendar size={16} color={theme.textSecondary} />
                    <Text
                      style={[
                        styles.dateButtonText,
                        { color: tempStartDate ? theme.text : theme.textSecondary },
                      ]}
                    >
                      {formatDate(tempStartDate) || '开始日期'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.dateSeparator, { color: theme.textSecondary }]}>至</Text>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                    onPress={() => setShowEndDatePicker(true)}
                  >
                    <Calendar size={16} color={theme.textSecondary} />
                    <Text
                      style={[
                        styles.dateButtonText,
                        { color: tempEndDate ? theme.text : theme.textSecondary },
                      ]}
                    >
                      {formatDate(tempEndDate) || '结束日期'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {showStartDatePicker && (
                  <DateTimePicker
                    value={tempStartDate ? new Date(tempStartDate) : new Date()}
                    mode="date"
                    display="default"
                    onChange={onStartDateChange}
                    maximumDate={tempEndDate ? new Date(tempEndDate) : new Date()}
                  />
                )}

                {showEndDatePicker && (
                  <DateTimePicker
                    value={tempEndDate ? new Date(tempEndDate) : new Date()}
                    mode="date"
                    display="default"
                    onChange={onEndDateChange}
                    minimumDate={tempStartDate ? new Date(tempStartDate) : undefined}
                    maximumDate={new Date()}
                  />
                )}
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.resetButton, { borderColor: theme.border }]}
                onPress={clearFilters}
              >
                <Text style={[styles.resetButtonText, { color: theme.text }]}>重置</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.applyButton, { backgroundColor: theme.primary }]}
                onPress={handleApplyFilters}
              >
                <Text style={styles.applyButtonText}>应用</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalBody: {
    padding: 16,
    paddingBottom: 0,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  filterSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  archiveOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  archiveOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  archiveOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  dateButtonText: {
    fontSize: 14,
  },
  dateSeparator: {
    fontSize: 14,
  },
  resetButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  applyButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
})
