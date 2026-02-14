import { MoodDragBar } from '@/components/diary/MoodDragBar'
import { MemoCard } from '@/components/memo/MemoCard'
import { Loading, toast } from '@/components/ui'
import { MOODS, type MoodKey } from '@/constants/common'
import { useConnection } from '@/hooks/use-connection'
import { useErrorHandler } from '@/hooks/use-error-handler'
import { useDiary, useUpdateDiaryMood } from '@/lib/query'
import { MOOD_COLOR_MAP } from '@/lib/utils/mood'
import { useThemeStore } from '@/stores/theme-store'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'

interface DayPageViewProps {
  date: string
  onMemoPress?: (memoId: string) => void
}

/**
 * Get color with adjusted opacity based on intensity
 * intensity: 1-10, higher = more intense/darker
 */
function getMoodColorWithIntensity(moodKey: MoodKey, intensity: number): string {
  const baseColor = MOOD_COLOR_MAP[moodKey] || MOOD_COLOR_MAP.neutral
  // Convert hex to RGBA with opacity based on intensity
  // intensity 1 = 30% opacity, intensity 10 = 100% opacity
  const opacity = 0.3 + (intensity / 10) * 0.7

  // Parse hex color
  const hex = baseColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

/**
 * Get darker/border color for the mood indicator
 */
function getMoodBorderColor(moodKey: MoodKey): string {
  const baseColor = MOOD_COLOR_MAP[moodKey] || MOOD_COLOR_MAP.neutral
  const hex = baseColor.replace('#', '')
  const r = Math.max(0, parseInt(hex.substring(0, 2), 16) - 40)
  const g = Math.max(0, parseInt(hex.substring(2, 4), 16) - 40)
  const b = Math.max(0, parseInt(hex.substring(4, 6), 16) - 40)
  return `rgb(${r}, ${g}, ${b})`
}

export function DayPageView({ date, onMemoPress }: DayPageViewProps) {
  const { theme } = useThemeStore()
  const { canUseNetwork } = useConnection()
  const handleError = useErrorHandler()

  const { data: diary, isLoading } = useDiary(date)
  const { mutateAsync: updateMood, isPending: isSavingMood } = useUpdateDiaryMood()

  const [showMoodDialog, setShowMoodDialog] = useState(false)
  const [dialogMood, setDialogMood] = useState<MoodKey | null>(null)
  const [dialogIntensity, setDialogIntensity] = useState(5)

  useEffect(() => {
    if (showMoodDialog) {
      if (diary?.moodKey) {
        setDialogMood(diary.moodKey)
      }
      if (diary?.moodScore !== undefined && diary?.moodScore !== null) {
        setDialogIntensity(diary.moodScore)
      } else {
        setDialogIntensity(5)
      }
    }
  }, [showMoodDialog, diary])

  const archivedMemos = useMemo(() => {
    if (!diary?.memos?.length) return []
    return diary.memos.filter((memo) => memo.isArchived)
  }, [diary?.memos])

  const handleMemoPress = useCallback(
    (memoId: string) => {
      onMemoPress?.(memoId)
    },
    [onMemoPress]
  )

  const handleOpenMoodDialog = useCallback(() => {
    if (!canUseNetwork) return
    setShowMoodDialog(true)
  }, [canUseNetwork])

  const handleCloseMoodDialog = useCallback(() => {
    setShowMoodDialog(false)
  }, [])

  const handleDialogMoodChange = useCallback((mood: MoodKey) => {
    setDialogMood(mood)
  }, [])

  const handleDialogIntensityChange = useCallback((value: number) => {
    setDialogIntensity(value)
  }, [])

  const handleMoodSave = useCallback(async () => {
    if (!dialogMood || !canUseNetwork) return

    try {
      await updateMood({
        date,
        data: { moodKey: dialogMood, moodScore: dialogIntensity },
      })
      toast.success('成功', '已保存')
      setShowMoodDialog(false)
    } catch (error) {
      handleError(error)
      toast.error('错误', '保存失败')
    }
  }, [dialogMood, date, dialogIntensity, canUseNetwork, updateMood, handleError])

  if (isLoading) {
    return (
      <View style={[styles.centeredContainer, { backgroundColor: theme.background }]}>
        <Loading text="加载中..." />
      </View>
    )
  }

  if (!diary) {
    return (
      <View style={[styles.centeredContainer, { backgroundColor: theme.background }]}>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {date} 日记不存在
          </Text>
        </View>
      </View>
    )
  }

  const displayMood = diary.moodKey || 'neutral'
  const displayIntensity = diary.moodScore ?? 5
  const moodColor = getMoodColorWithIntensity(displayMood, displayIntensity)
  const moodBorderColor = getMoodBorderColor(displayMood)

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {diary.summary && (
        <View style={[styles.card, { borderColor: theme.border }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>今日总结</Text>
          <Text style={[styles.summaryText, { color: theme.text }]}>{diary.summary}</Text>
        </View>
      )}

      {/* Compact Mood Display */}
      <View style={[styles.card, { borderColor: theme.border }]}>
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>心情</Text>
        <TouchableOpacity
          style={[
            styles.moodDisplay,
            { backgroundColor: moodColor, borderColor: moodBorderColor },
          ]}
          onPress={handleOpenMoodDialog}
          disabled={!canUseNetwork}
          activeOpacity={canUseNetwork ? 0.7 : 1}
        >
          <Text style={[styles.moodIntensity, { color: theme.text }]}>{displayIntensity}</Text>
        </TouchableOpacity>
      </View>

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

      {/* Mood Edit Dialog */}
      <Modal visible={showMoodDialog} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={handleCloseMoodDialog}>
          <View style={styles.dialogOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.dialogContent, { backgroundColor: theme.surface }]}>
                <Text style={[styles.dialogTitle, { color: theme.text }]}>编辑心情</Text>

                {/* Mood Selection */}
                <Text style={[styles.dialogLabel, { color: theme.textSecondary }]}>选择心情</Text>
                <View style={styles.dialogMoodSelector}>
                  {MOODS.map((mood) => (
                    <TouchableOpacity
                      key={mood.key}
                      style={[
                        styles.dialogMoodOption,
                        { backgroundColor: mood.color },
                        dialogMood === mood.key && {
                          borderColor: theme.text,
                        },
                      ]}
                      onPress={() => handleDialogMoodChange(mood.key)}
                    >
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>{mood.label[0]}</Text>
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>{mood.label[1]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Intensity Slider */}
                {dialogMood && (
                  <View style={styles.dialogIntensitySection}>
                    <Text style={[styles.dialogLabel, { color: theme.textSecondary }]}>
                      浓度: {dialogIntensity}
                    </Text>
                    <MoodDragBar
                      value={dialogIntensity}
                      onChange={handleDialogIntensityChange}
                      disabled={!canUseNetwork}
                    />
                  </View>
                )}

                {/* Dialog Actions */}
                <View style={styles.dialogActions}>
                  <TouchableOpacity
                    style={[styles.dialogButton, { backgroundColor: theme.surface }]}
                    onPress={handleCloseMoodDialog}
                  >
                    <Text style={[styles.dialogButtonText, { color: theme.text }]}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.dialogButton,
                      { backgroundColor: theme.primary },
                      !dialogMood && styles.dialogButtonDisabled,
                    ]}
                    onPress={handleMoodSave}
                    disabled={!dialogMood || isSavingMood}
                  >
                    <Text style={[styles.dialogButtonText, { color: '#fff' }]}>
                      {isSavingMood ? '保存中...' : '保存'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
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
  // Dialog styles
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogContent: {
    width: '85%',
    borderRadius: 16,
    padding: 20,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  dialogLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  dialogMoodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  dialogMoodOption: {
    flex: 1,
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogIntensitySection: {
    marginBottom: 16,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 12,
  },
  dialogButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  dialogButtonDisabled: {
    opacity: 0.5,
  },
  dialogButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
})
