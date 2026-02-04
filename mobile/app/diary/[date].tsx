import { MoodDragBar } from '@/components/diary/MoodDragBar'
import { MemoCard } from '@/components/memo/MemoCard'
import { Button, Loading, toast } from '@/components/ui'
import { MOODS, type MoodKey } from '@/constants/common'
import { useConnection } from '@/hooks/use-connection'
import { useErrorHandler } from '@/hooks/use-error-handler'
import { useDiary, useUpdateDiaryMood } from '@/lib/query'
import { useThemeStore } from '@/stores/theme-store'
import { router, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, Calendar } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export default function DiaryDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>()
  const { theme } = useThemeStore()
  const { canUseNetwork } = useConnection()
  const handleError = useErrorHandler()
  const { data: diary, isLoading } = useDiary(date || '')
  const { mutateAsync: updateMood, isPending: isSavingMood } = useUpdateDiaryMood()

  const [selectedMood, setSelectedMood] = useState<MoodKey | null>(diary?.moodKey || null)
  const [intensity, setIntensity] = useState(3)

  const handleMemoPress = (memoId: string) => {
    router.push({ pathname: '/memo/[id]', params: { id: memoId } })
  }

  const handleMoodSave = useCallback(async () => {
    if (!selectedMood || !date || !canUseNetwork) return

    try {
      await updateMood({
        date,
        data: { moodKey: selectedMood, moodScore: intensity },
      })
      toast.success('成功', '已保存')
    } catch (error) {
      handleError(error)
      toast.error('错误', '保存失败')
    }
  }, [selectedMood, date, intensity, canUseNetwork, updateMood, handleError])

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Loading text="加载中..." fullScreen />
      </View>
    )
  }

  if (!diary) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderColor: theme.border }]}>
          <TouchableOpacity onPress={router.back} style={styles.backButton}>
            <ArrowLeft size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>日记详情</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>日记不存在</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={router.back} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Calendar size={18} color={theme.textSecondary} />
          <Text style={[styles.dateText, { color: theme.text }]}>{diary.date}</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {diary.summary && (
          <View
            style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>今日总结</Text>
            <Text style={[styles.summaryText, { color: theme.text }]}>{diary.summary}</Text>
          </View>
        )}

        <View style={[styles.moodCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.moodLabel, { color: theme.textSecondary }]}>心情</Text>
          <View style={styles.moodSelector}>
            {MOODS.map(mood => (
              <TouchableOpacity
                key={mood.key}
                style={[
                  styles.moodOption,
                  selectedMood === mood.key && { backgroundColor: theme.primary + '20' },
                ]}
                onPress={() => setSelectedMood(mood.key)}
                disabled={!canUseNetwork}
              >
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {selectedMood && (
            <View style={styles.intensitySection}>
              <MoodDragBar value={intensity} onChange={setIntensity} disabled={!canUseNetwork} />
              <Button
                title="保存"
                variant="primary"
                onPress={handleMoodSave}
                loading={isSavingMood}
                disabled={!canUseNetwork}
              />
            </View>
          )}
        </View>

        {diary.memos && diary.memos.length > 0 && (
          <View style={styles.memosSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>相关Memo</Text>
            {diary.memos.map(memo => (
              <MemoCard key={memo.id} memo={memo} onPress={() => handleMemoPress(memo.id)} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    width: 40,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 24,
  },
  moodCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  moodLabel: {
    fontSize: 14,
    marginBottom: 12,
  },
  moodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  moodOption: {
    padding: 8,
    borderRadius: 8,
  },
  moodEmoji: {
    fontSize: 24,
  },
  intensitySection: {
    gap: 16,
  },
  memosSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
})
