import { MoodDragBar } from '@/components/diary/MoodDragBar'
import { MemoCard } from '@/components/memo/MemoCard'
import { Loading } from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import { useTranslation } from 'react-i18next'
import { useDiary, useUpdateDiary } from '@/lib/query'
import { useThemeStore } from '@/stores/themeStore'
import type { MemoWithResources } from '@mosaic/api'
import { MOODS, type MoodKey } from '@mosaic/utils'
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

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

const MoodCircle = React.memo(function MoodCircle({
  mood,
  selected,
  onPress,
}: {
  mood: { key: string; color: string }
  selected: boolean
  onPress: () => void
}) {
  const scale = useSharedValue(selected ? 1.08 : 1)
  const opacity = useSharedValue(selected ? 1 : 0.38)

  useEffect(() => {
    scale.value = withTiming(selected ? 1.08 : 1, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    })
    opacity.value = withTiming(selected ? 1 : 0.38, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    })
  }, [selected, scale, opacity])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ flex: 1 }}>
      <Animated.View
        style={[
          styles.moodCircle,
          { backgroundColor: mood.color },
          selected ? { borderWidth: 2.5, borderColor: mood.color } : styles.moodCircleUnselected,
          animStyle,
        ]}
      />
    </TouchableOpacity>
  )
})

export const DayPageView = React.memo(
  forwardRef<DayPageViewRef, DayPageViewProps>(function DayPageView(
    { date, onMemoPress, isEditing, onEditStateChange },
    ref
  ) {
    const { t } = useTranslation()
    const theme = useThemeStore(s => s.theme)
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

    const hasChanges = useMemo(
      () =>
        summaryDraft.trim() !== (diary?.summary ?? '').trim() ||
        moodKeyDraft !== (diary?.moodKey as MoodKey | undefined) ||
        moodScoreDraft !== (diary?.moodScore ?? 5),
      [summaryDraft, diary?.summary, moodKeyDraft, diary?.moodKey, moodScoreDraft, diary?.moodScore]
    )

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
        toast.error(t('dayPageView.saveFailed'))
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

    useImperativeHandle(
      ref,
      () => ({
        hasChanges,
        isPending: updateDiary.isPending,
        hasDiary: !!diary,
        save: handleSave,
        cancel: handleCancel,
      }),
      [hasChanges, updateDiary.isPending, diary, handleSave, handleCancel]
    )

    const handleMemoPress = useCallback((memoId: string) => onMemoPress?.(memoId), [onMemoPress])

    // Create stable press handler refs for each memo to avoid defeating MemoCard's React.memo
    const memoPressHandlers = useMemo(() => {
      const handlers: Record<string, () => void> = {}
      for (const memo of archivedMemos) {
        handlers[memo.id] = () => handleMemoPress(memo.id)
      }
      return handlers
    }, [archivedMemos, handleMemoPress])

    if (isLoading) {
      return (
        <View style={styles.centeredContainer}>
          <Loading text={t('common.loading')} />
        </View>
      )
    }

    if (!diary) {
      return (
        <View style={styles.centeredContainer}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {t('dayPageView.diaryNotFound', { date })}
          </Text>
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
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              {t('dayPageView.todaySummary')}
            </Text>
            {isEditing ? (
              <TextInput
                value={summaryDraft}
                onChangeText={setSummaryDraft}
                placeholder={t('dayPageView.summaryPlaceholder')}
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
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              {t('dayPageView.todayMood')}
            </Text>
            <View style={styles.moodCircles}>
              {MOODS.map(mood => {
                const selected = moodKeyDraft === mood.key
                return (
                  <MoodCircle
                    key={mood.key}
                    mood={mood}
                    selected={selected}
                    onPress={() => setMoodKeyDraft(mood.key)}
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
                onPress={isEditing ? undefined : memoPressHandlers[memo.id]}
                showActions={false}
                showPressFeedback={false}
              />
            ))
          ) : (
            <Text style={[styles.emptyArchiveText, { color: theme.textSecondary }]}>
              {t('dayPageView.noArchivedMemos')}
            </Text>
          )}
        </View>
      </ScrollView>
    )
  })
)

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
    paddingHorizontal: 12,
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
    justifyContent: 'space-between',
    gap: 10,
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
    borderWidth: 2.5,
  },
  moodCircleUnselected: {
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
    paddingHorizontal: 12,
  },
  emptyText: {
    fontSize: 15,
  },
})
