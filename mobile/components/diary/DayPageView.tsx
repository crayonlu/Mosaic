import { MoodDragBar } from '@/components/diary/MoodDragBar'
import { MemoCard } from '@/components/memo/MemoCard'
import { Loading } from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import { useDiary, useUpdateDiary } from '@/lib/query'
import { useThemeStore } from '@/stores/themeStore'
import { MOODS, type MoodKey } from '@mosaic/utils'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import type { MemoWithResources } from '@mosaic/api'

export interface DayPageViewRef {
  hasChanges: boolean
  isPending: boolean
  hasDiary: boolean
  save: () => Promise<void>
  cancel: () => void
}

interface DayPageViewProps {
  date: string
  onMemoPress?: (memoId: string) => void
  isEditing: boolean
  onEditStateChange?: () => void
}

export const DayPageView = forwardRef<DayPageViewRef, DayPageViewProps>(function DayPageView(
  { date, onMemoPress, isEditing, onEditStateChange },
  ref
) {
  const { theme } = useThemeStore()
  const [summaryDraft, setSummaryDraft] = useState('')
  const [moodKeyDraft, setMoodKeyDraft] = useState<MoodKey | undefined>(undefined)
  const [moodScoreDraft, setMoodScoreDraft] = useState(5)

  const { data: diary, isLoading } = useDiary(date)
  const updateDiary = useUpdateDiary()
  const archivedMemos = useMemo<MemoWithResources[]>(() => diary?.memos ?? [], [diary?.memos])

  useEffect(() => {
    if (!isEditing) {
      setSummaryDraft(diary?.summary ?? '')
      setMoodKeyDraft(diary?.moodKey as MoodKey | undefined)
      setMoodScoreDraft(diary?.moodScore ?? 5)
    }
  }, [diary?.summary, diary?.moodKey, diary?.moodScore, isEditing])

  useEffect(() => {
    setSummaryDraft(diary?.summary ?? '')
    setMoodKeyDraft(diary?.moodKey as MoodKey | undefined)
    setMoodScoreDraft(diary?.moodScore ?? 5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const hasChanges =
    summaryDraft.trim() !== (diary?.summary ?? '').trim() ||
    moodKeyDraft !== (diary?.moodKey as MoodKey | undefined) ||
    moodScoreDraft !== (diary?.moodScore ?? 5)

  const handleSave = useCallback(async () => {
    if (!diary) return
    try {
      await updateDiary.mutateAsync({
        date,
        data: {
          summary: summaryDraft.trim(),
          moodKey: moodKeyDraft as any,
          moodScore: moodScoreDraft,
        },
      })
    } catch {
      toast.error('保存失败')
    }
  }, [diary, date, summaryDraft, moodKeyDraft, moodScoreDraft, updateDiary])

  const handleCancel = useCallback(() => {
    setSummaryDraft(diary?.summary ?? '')
    setMoodKeyDraft(diary?.moodKey as MoodKey | undefined)
    setMoodScoreDraft(diary?.moodScore ?? 5)
  }, [diary?.summary, diary?.moodKey, diary?.moodScore])

  // Notify parent when hasChanges flips so the save button re-evaluates.
  // useImperativeHandle runs before this effect, so the ref is already updated.
  useEffect(() => {
    if (isEditing) onEditStateChange?.()
  }, [hasChanges, isEditing]) // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    hasChanges,
    isPending: updateDiary.isPending,
    hasDiary: !!diary,
    save: handleSave,
    cancel: handleCancel,
  }), [hasChanges, updateDiary.isPending, diary, handleSave, handleCancel])

  const handleMemoPress = useCallback(
    (memoId: string) => onMemoPress?.(memoId),
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
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{date} 日记不存在</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Summary */}
      {(diary.summary || isEditing) && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>今日总结</Text>
          {isEditing ? (
            <TextInput
              value={summaryDraft}
              onChangeText={setSummaryDraft}
              placeholder="写下今天的心情或总结..."
              placeholderTextColor={theme.textSecondary}
              multiline
              textAlignVertical="top"
              style={[styles.summaryInput, { color: theme.text }]}
            />
          ) : (
            <Text style={[styles.summaryText, { color: theme.text }]}>{diary.summary}</Text>
          )}
        </View>
      )}

      {/* Mood selector — only in edit mode, circles only */}
      {isEditing && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>今日心情</Text>
          <View style={styles.moodCircles}>
            {MOODS.map(mood => {
              const selected = moodKeyDraft === mood.key
              return (
                <TouchableOpacity
                  key={mood.key}
                  style={[
                    styles.moodCircle,
                    { backgroundColor: mood.color },
                    selected
                      ? [styles.moodCircleSelected, { borderColor: mood.color }]
                      : styles.moodCircleUnselected,
                  ]}
                  onPress={() => setMoodKeyDraft(mood.key)}
                  activeOpacity={0.7}
                />
              )
            })}
          </View>
          {moodKeyDraft && (
            <View style={styles.intensityRow}>
              <MoodDragBar value={moodScoreDraft} onChange={setMoodScoreDraft} />
              <Text style={[styles.intensityValue, { color: theme.textSecondary }]}>
                {moodScoreDraft}/10
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Memo list */}
      <View style={styles.memosSection}>
        {archivedMemos.length > 0 ? (
          archivedMemos.map(memo => (
            <MemoCard
              key={memo.id}
              memo={memo}
              onPress={isEditing ? undefined : () => handleMemoPress(memo.id)}
              showActions={false}
              showPressFeedback={false}
            />
          ))
        ) : (
          <Text style={[styles.emptyArchiveText, { color: theme.textSecondary }]}>
            当天暂无已归档 Memo
          </Text>
        )}
      </View>
    </ScrollView>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  content: {
    paddingTop: 12,
    paddingBottom: 32,
    gap: 20,
  },
  section: {
    paddingHorizontal: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 24,
  },
  summaryInput: {
    fontSize: 15,
    lineHeight: 24,
    minHeight: 96,
    textAlignVertical: 'top',
  },

  // Mood: circles only, no labels
  moodCircles: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  moodCircle: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  moodCircleSelected: {
    transform: [{ scale: 1.12 }],
    // White outer ring via outline-equivalent: shadow on iOS
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    // The borderColor is set inline to mood.color for the inner ring
    borderWidth: 2.5,
  },
  moodCircleUnselected: {
    opacity: 0.38,
    borderColor: 'transparent',
  },
  intensityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  intensityValue: {
    fontSize: 12,
    width: 32,
    textAlign: 'right',
  },

  memosSection: {
    gap: 1,
  },
  emptyArchiveText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 15,
  },
})
