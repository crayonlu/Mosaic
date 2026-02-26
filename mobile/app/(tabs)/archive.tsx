import { ArchiveDateFilter } from '@/components/archive/ArchiveDateFilter'
import { ArchiveDialog } from '@/components/archive/ArchiveDialog'
import { MemoFeed } from '@/components/archive/MemoFeed'
import { toast } from '@/components/ui/Toast'
import { useDeleteMemo, useDiary } from '@/lib/query'
import { useThemeStore } from '@/stores/theme-store'
import type { MemoWithResources } from '@mosaic/api'
import { memosApi } from '@mosaic/api'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'

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

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ArchiveDateFilter
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        isArchiveMode={isArchiveMode}
        hasSelection={selectedMemoIds.length > 0}
        showAddButton={shouldShowAddButton}
        onArchivePress={handleArchivePress}
      />
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
        existingDiary={todayDiary}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
