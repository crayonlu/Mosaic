import { ArchiveDateFilter } from '@/components/archive/ArchiveDateFilter'
import { MemoFeed } from '@/components/archive/MemoFeed'
import { MoodSelector } from '@/components/archive/MoodSelector'
import { diariesApi, memosApi } from '@/lib/api'
import { toast } from '@/components/ui'
import { useConnection } from '@/hooks/use-connection'
import { useErrorHandler } from '@/hooks/use-error-handler'
import { useThemeStore } from '@/stores/theme-store'
import type { MemoWithResources } from '@/types/memo'
import type { MoodKey } from '@/constants/common'
import { router } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

export default function ArchiveScreen() {
  const { theme } = useThemeStore()
  const { canUseNetwork } = useConnection()
  const handleError = useErrorHandler()
  const [selectedDate, setSelectedDate] = useState<string | undefined>(new Date().toISOString().split('T')[0])
  const [isArchiveMode, setIsArchiveMode] = useState(false)
  const [selectedMemoIds, setSelectedMemoIds] = useState<string[]>([])
  const [showMoodSelector, setShowMoodSelector] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleMemoPress = (memo: MemoWithResources) => {
    if (!isArchiveMode) {
      router.push({ pathname: '/memo/[id]', params: { id: memo.id } })
    }
  }

  const handleMemoDelete = (id: string) => {
    console.log('Delete memo:', id)
  }

  const handleSelectionChange = (id: string) => {
    setSelectedMemoIds(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
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
    if (!canUseNetwork || !selectedDate) {
      return
    }
    setSubmitting(true)
    try {
      await diariesApi.create(selectedDate, {
        summary: summary || `${selectedMemoIds.length} 条备忘录`,
        moodKey,
        moodScore: 1,
      })

      for (const id of selectedMemoIds) {
        await memosApi.archive(id)
      }

      toast.success('成功', '已归档到日记')
      setShowMoodSelector(false)
      setIsArchiveMode(false)
      setSelectedMemoIds([])
    } catch (error) {
      handleError(error)
      toast.error('错误', '归档失败')
    } finally {
      setSubmitting(false)
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
        submitting={submitting}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
})
