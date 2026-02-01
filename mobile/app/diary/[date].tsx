import { MemoCard } from '@/components/memo/MemoCard'
import { Loading, toast } from '@/components/ui'
import { diariesApi } from '@/lib/api'
import { useThemeStore } from '@/stores/theme-store'
import { type DiaryWithMemosResponse } from '@/types/api'
import { router, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, Calendar } from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export default function DiaryDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>()
  const { theme } = useThemeStore()
  const [diary, setDiary] = useState<DiaryWithMemosResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const loadDiary = useCallback(async () => {
    if (!date) return
    try {
      const data = await diariesApi.get(date)
      setDiary(data)
    } catch (error) {
      console.error('Load diary error:', error)
      toast.error('错误', '加载日记失败')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    loadDiary()
  }, [loadDiary])

  const handleMemoPress = (memoId: string) => {
    router.push({ pathname: '/memo/[id]', params: { id: memoId } })
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Loading text="加载中..." fullScreen />
      </View>
    )
  }

  if (!diary) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
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

        {diary.moodKey && (
          <View
            style={[styles.moodCard, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <Text style={[styles.moodLabel, { color: theme.textSecondary }]}>心情</Text>
            <Text style={styles.moodEmoji}>{diary.moodKey}</Text>
            <Text style={[styles.moodScore, { color: theme.text }]}>
              评分: {diary.moodScore}/10
            </Text>
          </View>
        )}

        {diary.memos && diary.memos.length > 0 && (
          <View style={styles.memosSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>相关备忘录</Text>
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
    alignItems: 'center',
  },
  moodLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  moodEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  moodScore: {
    fontSize: 14,
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
