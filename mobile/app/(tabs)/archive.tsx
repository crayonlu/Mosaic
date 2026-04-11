import { ArchiveDateFilter } from '@/components/archive/ArchiveDateFilter'
import { ArchiveDialog } from '@/components/archive/ArchiveDialog'
import { MemoFeed } from '@/components/archive/MemoFeed'
import { toast } from '@/components/ui/Toast'
import { useDeleteMemo, useDiary } from '@/lib/query'
import { useThemeStore } from '@/stores/themeStore'
import type { MemoWithResources } from '@mosaic/api'
import { memosApi } from '@mosaic/api'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { router } from 'expo-router'
import { Check, X } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export default function ArchiveScreen() {
  const { theme } = useThemeStore()
  const [selectedDate, setSelectedDate] = useState<string | undefined>(dayjs().format('YYYY-MM-DD'))
  const [isArchiveMode, setIsArchiveMode] = useState(false)
  const [selectedMemoIds, setSelectedMemoIds] = useState<string[]>([])
  const [visibleMemos, setVisibleMemos] = useState<MemoWithResources[]>([])
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const queryClient = useQueryClient()
  const { mutateAsync: deleteMemo } = useDeleteMemo()

  const today = dayjs().format('YYYY-MM-DD')
  const { data: todayDiary } = useDiary(today)
  const hasDiaryForToday = !!todayDiary

  const selectedMemos = useMemo(() => {
    return visibleMemos.filter(m => selectedMemoIds.includes(m.id))
  }, [visibleMemos, selectedMemoIds])

  const handleMemoPress = (memo: MemoWithResources) => {
    if (!isArchiveMode) router.push({ pathname: '/memo/[id]', params: { id: memo.id } })
  }

  const handleMemoDelete = (id: string) => {
    deleteMemo(id)
  }

  const handleSelectionChange = (id: string) => {
    setSelectedMemoIds(prev => (prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]))
  }

  const handleArchivePress = () => {
    if (isArchiveMode) {
      if (selectedMemoIds.length > 0) {
        if (hasDiaryForToday && selectedDate === today) {
          handleDirectArchive()
        } else {
          setShowArchiveDialog(true)
        }
      } else {
        setIsArchiveMode(false)
        setSelectedMemoIds([])
      }
    } else {
      setIsArchiveMode(true)
      setSelectedMemoIds([])
    }
  }

  const handleDirectArchive = async () => {
    try {
      for (const memo of selectedMemos) {
        await memosApi.archive(memo.id, today)
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['memos'] }),
        queryClient.invalidateQueries({ queryKey: ['diaries'] }),
        queryClient.invalidateQueries({ queryKey: ['diary', today] }),
      ])
      toast.success('添加成功')
      setIsArchiveMode(false)
      setSelectedMemoIds([])
    } catch (error) {
      console.error('添加失败:', error)
      toast.error('添加失败')
    }
  }

  const shouldShowAddButton =
    isArchiveMode && selectedMemoIds.length > 0 && hasDiaryForToday && selectedDate === today

  const handleArchiveSuccess = () => {
    setShowArchiveDialog(false)
    setIsArchiveMode(false)
    setSelectedMemoIds([])
  }

  const selectedCount = selectedMemoIds.length

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.topArea}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>归档</Text>
            <Text style={[styles.headerSubTitle, { color: theme.textSecondary }]}>整理今天的记录，沉淀成日记{isArchiveMode ? ` · 已选 ${selectedCount} 条` : ''}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.archiveActionButton,
              {
                backgroundColor:
                  selectedCount > 0 || shouldShowAddButton ? theme.primary : theme.surfaceMuted,
                borderRadius: theme.radius.medium,
              },
            ]}
            onPress={handleArchivePress}
            activeOpacity={theme.state.pressedOpacity}
          >
            {selectedCount > 0 || shouldShowAddButton ? (
              <Check size={18} color={theme.onPrimary} />
            ) : isArchiveMode ? (
              <X size={18} color={theme.textSecondary} />
            ) : null}
            <Text
              style={[
                styles.archiveActionText,
                {
                  color:
                    selectedCount > 0 || shouldShowAddButton ? theme.onPrimary : theme.textSecondary,
                },
              ]}
            >
              {shouldShowAddButton
                ? '添加'
                : selectedCount > 0
                  ? '归档'
                  : isArchiveMode
                    ? '完成'
                    : '归档'}
            </Text>
          </TouchableOpacity>
        </View>

        <ArchiveDateFilter
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
        />
      </View>

      <MemoFeed
        targetDate={selectedDate}
        onMemoPress={handleMemoPress}
        onMemoDelete={handleMemoDelete}
        isSelectionMode={isArchiveMode}
        selectedIds={selectedMemoIds}
        onSelectionChange={handleSelectionChange}
        onMemosChange={setVisibleMemos}
      />
      <ArchiveDialog
        visible={showArchiveDialog}
        selectedMemos={selectedMemos}
        targetDate={selectedDate || dayjs().format('YYYY-MM-DD')}
        onSuccess={handleArchiveSuccess}
        onCancel={() => setShowArchiveDialog(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topArea: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 2,
  },
  headerSubTitle: {
    fontSize: 12,
  },
  archiveActionButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  archiveActionText: {
    fontSize: 15,
    fontWeight: '500',
  },
})
