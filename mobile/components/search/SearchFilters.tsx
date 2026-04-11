import { Badge, DatePickerSheet } from '@/components/ui'
import { useThemeStore } from '@/stores/themeStore'
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { Calendar, Filter } from 'lucide-react-native'
import { useCallback, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

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
  const sheetRef = useRef<BottomSheetModal>(null)
  const [activeDateTarget, setActiveDateTarget] = useState<'start' | 'end' | null>(null)

  const [tempSelectedTags, setTempSelectedTags] = useState<string[]>(selectedTags)
  const [tempIsArchived, setTempIsArchived] = useState<boolean | undefined>(isArchived)
  const [tempStartDate, setTempStartDate] = useState<string | undefined>(startDate)
  const [tempEndDate, setTempEndDate] = useState<string | undefined>(endDate)

  const hasActiveFilters =
    selectedTags.length > 0 || startDate || endDate || isArchived !== undefined

  const snapPoints = useMemo(() => ['50%'], [])

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.35}
        pressBehavior="close"
      />
    ),
    []
  )

  const handleOpenFilters = () => {
    setTempSelectedTags(selectedTags)
    setTempIsArchived(isArchived)
    setTempStartDate(startDate)
    setTempEndDate(endDate)
    sheetRef.current?.present()
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
    sheetRef.current?.dismiss()
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

  const activePickerDate = activeDateTarget === 'start' ? tempStartDate : tempEndDate

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            {
              backgroundColor: hasActiveFilters ? theme.semantic.infoSoft : theme.surfaceMuted,
              borderColor: 'transparent',
              borderRadius: theme.radius.medium,
              paddingHorizontal: theme.spacingScale.medium,
              paddingVertical: theme.spacingScale.medium,
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
              <Text style={[styles.badgeText, { color: theme.onPrimary }]}>
                {selectedTags.length +
                  (startDate || endDate ? 1 : 0) +
                  (isArchived !== undefined ? 1 : 0)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <BottomSheetModal
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: theme.background }}
        handleIndicatorStyle={{ backgroundColor: theme.textSecondary }}
        keyboardBehavior="interactive"
      >
        <BottomSheetScrollView
          style={styles.modalBody}
          contentContainerStyle={styles.modalBodyContent}
        >
          <View style={{ flex: 1 }}>
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
                          tempIsArchived === option.value ? theme.primary : theme.surfaceMuted,
                        borderColor: 'transparent',
                        borderRadius: theme.radius.medium,
                      },
                    ]}
                    onPress={() => setTempIsArchived(option.value as boolean | undefined)}
                  >
                    <Text
                      style={[
                        styles.archiveOptionText,
                        { color: tempIsArchived === option.value ? theme.onPrimary : theme.text },
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
                    {
                      backgroundColor: theme.surfaceMuted,
                      borderColor: 'transparent',
                      borderRadius: theme.radius.medium,
                    },
                  ]}
                  onPress={() => setActiveDateTarget('start')}
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
                    {
                      backgroundColor: theme.surfaceMuted,
                      borderColor: 'transparent',
                      borderRadius: theme.radius.medium,
                    },
                  ]}
                  onPress={() => setActiveDateTarget('end')}
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
            </View>
          </View>
          <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[
                styles.resetButton,
                {
                  backgroundColor: theme.surfaceMuted,
                  borderColor: 'transparent',
                  borderRadius: theme.radius.medium,
                },
              ]}
              onPress={clearFilters}
            >
              <Text style={[styles.resetButtonText, { color: theme.text }]}>重置</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.applyButton,
                { backgroundColor: theme.primary, borderRadius: theme.radius.medium },
              ]}
              onPress={handleApplyFilters}
            >
              <Text style={[styles.applyButtonText, { color: theme.onPrimary }]}>应用</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>

      <DatePickerSheet
        visible={activeDateTarget !== null}
        title={activeDateTarget === 'start' ? '开始日期' : '结束日期'}
        selectedDate={activePickerDate}
        minDate={activeDateTarget === 'end' ? tempStartDate : undefined}
        maxDate={activeDateTarget === 'start' ? tempEndDate : undefined}
        onSelect={date => {
          if (activeDateTarget === 'start') {
            setTempStartDate(date)
          } else if (activeDateTarget === 'end') {
            setTempEndDate(date)
          }
        }}
        onClear={() => {
          if (activeDateTarget === 'start') {
            setTempStartDate(undefined)
          } else if (activeDateTarget === 'end') {
            setTempEndDate(undefined)
          }
        }}
        onClose={() => setActiveDateTarget(null)}
      />
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
    fontSize: 11,
    fontWeight: '500',
  },
  modalBody: {
    paddingHorizontal: 16,
  },
  modalBodyContent: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  filterSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
  },
  archiveOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  archiveOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  applyButton: {
    flex: 2,
    paddingVertical: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
})
