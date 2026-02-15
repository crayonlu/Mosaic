import { MemoCard } from '@/components/memo/MemoCard'
import { Loading } from '@/components/ui'
import { useDiary, } from '@/lib/query'
import { useThemeStore } from '@/stores/theme-store'
import { useCallback, useMemo } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

interface DayPageViewProps {
  date: string
  onMemoPress?: (memoId: string) => void
}

export function DayPageView({ date, onMemoPress }: DayPageViewProps) {
  const { theme } = useThemeStore()

  const { data: diary, isLoading } = useDiary(date)
  const archivedMemos = useMemo(() => diary?.memos ?? [], [diary?.memos])
  console.log(date, diary)
  const handleMemoPress = useCallback(
    (memoId: string) => {
      onMemoPress?.(memoId)
    },
    [onMemoPress]
  )
  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <Loading text="加载中..." />
      </View>
    )
  }

  if (!diary) {
    return (
      <View style={styles.centeredContainer}>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {date} 日记不存在
          </Text>
        </View>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {diary.summary && (
        <View style={[styles.card, { borderColor: theme.border }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>今日总结</Text>
          <Text style={[styles.summaryText, { color: theme.text }]}>{diary.summary}</Text>
        </View>
      )}

      <View style={styles.memosSection}>
        {archivedMemos.length > 0 ? (
          <View style={[styles.memosList]}>
            {archivedMemos.map((memo) => (
              <MemoCard
                key={memo.id}
                memo={memo}
                onPress={() => handleMemoPress(memo.id)}
                showActions={false}
              />
            ))}
          </View>
        ) : (
          <View style={[styles.emptyArchiveCard]}>
            <Text style={[styles.emptyArchiveText, { color: theme.textSecondary }]}>
              当天暂无已归档 Memo
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  content: {
    paddingTop: 10,
    paddingBottom: 16,
    gap: 10,
  },
  card: {
    padding: 12,
  },
  sectionLabel: {
    fontSize: 13,
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
  },
  // Compact mood display styles
  moodDisplay: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodIntensity: {
    fontSize: 18,
    fontWeight: '700',
  },
  memosSection: {
    marginTop: 2,
    gap: 8,
  },
  memosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  memoCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  memosList: {
    overflow: 'hidden',
  },
  emptyArchiveCard: {
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  emptyArchiveText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
  },
})
