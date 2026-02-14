import { ArchiveDateFilter } from '@/components/archive/ArchiveDateFilter'
import { MemoFeed } from '@/components/archive/MemoFeed'
import { MoodSelector } from '@/components/archive/MoodSelector'
import { toast } from '@/components/ui'
import type { MoodKey } from '@/constants/common'
import { useConnection } from '@/hooks/use-connection'
import { useErrorHandler } from '@/hooks/use-error-handler'
import { useArchiveMemo, useCreateDiary, useDeleteMemo } from '@/lib/query'
import { useThemeStore } from '@/stores/theme-store'
import type { MemoWithResources } from '@/types/memo'
import { router } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

export default function ArchiveScreen() {
  const { theme } = useThemeStore()
  const { canUseNetwork } = useConnection()
  const handleError = useErrorHandler()
  const [selectedDate, setSelectedDate] = useState<string | undefined>(
    new Date().toISOString().split('T')[0]
  )
  const [isArchiveMode, setIsArchiveMode] = useState(false)
  const [selectedMemoIds, setSelectedMemoIds] = useState<string[]>([])
  const [showMoodSelector, setShowMoodSelector] = useState(false)
  const { mutateAsync: createDiary, isPending: isCreatingDiary } = useCreateDiary()
  const { mutateAsync: archiveMemo, isPending: isArchiving } = useArchiveMemo()
  const { mutateAsync: deleteMemo, isPending: isDeleting } = useDeleteMemo()

  const isPending = isCreatingDiary || isArchiving || isDeleting

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
        setShowMoodSelector(true)
      } else {
        setIsArchiveMode(false)
        setSelectedMemoIds([])
      }
    } else {
      setIsArchiveMode(true)
      setSelectedMemoIds([])
      if (!selectedDate) {
        const today = new Date().toISOString().split('T')[0]
        setSelectedDate(today)
      }
    }
  }

  const handleMoodSubmit = async (moodKey: MoodKey, summary: string) => {
    if (!canUseNetwork || !selectedDate || isPending) {
      return
    }

    try {
      await createDiary({
        date: selectedDate,
        data: {
          summary: summary || `${selectedMemoIds.length} 条Memo`,
          moodKey,
          moodScore: 1,
        },
      })

      for (const id of selectedMemoIds) {
        await archiveMemo({ id, diaryDate: selectedDate })
      }

      toast.success('成功', '已归档')
      setShowMoodSelector(false)
      setIsArchiveMode(false)
      setSelectedMemoIds([])
    } catch (error) {
      handleError(error)
      toast.error('错误', '归档失败')
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ArchiveDateFilter
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        isArchiveMode={isArchiveMode}
        hasSelection={selectedMemoIds.length > 0}
        onArchivePress={handleArchivePress}
      />
      <MemoFeed
        targetDate={selectedDate}
        onMemoPress={handleMemoPress}
        onMemoDelete={handleMemoDelete}
        isSelectionMode={isArchiveMode}
        selectedIds={selectedMemoIds}
        onSelectionChange={handleSelectionChange}
      />
      <MoodSelector
        visible={showMoodSelector}
        onClose={() => setShowMoodSelector(false)}
        onSubmit={handleMoodSubmit}
        submitting={isPending}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
