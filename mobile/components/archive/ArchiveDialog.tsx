import { MoodDragBar } from '@/components/diary/MoodDragBar'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import i18n from '@/lib/i18n'
import { useThemeStore } from '@/stores/themeStore'
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { diariesApi, memosApi, type DiaryResponse, type MemoWithResources } from '@mosaic/api'
import { MOODS, type MoodKey } from '@mosaic/utils'
import { useQueryClient } from '@tanstack/react-query'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export interface ArchiveDialogProps {
  selectedMemos: MemoWithResources[]
  targetDate: string
  existingDiary?: DiaryResponse
  onSuccess: () => void
  onCancel: () => void
  onDismiss: () => void
}

export interface ArchiveDialogRef {
  present: () => void
  dismiss: () => void
}

export const ArchiveDialog = forwardRef<ArchiveDialogRef, ArchiveDialogProps>(
  function ArchiveDialog(
    { selectedMemos, targetDate, existingDiary, onSuccess, onCancel, onDismiss },
    ref
  ) {
    const { theme } = useThemeStore()
    useTranslation()
    const queryClient = useQueryClient()
    const sheetRef = useRef<BottomSheetModal>(null)

    const [summary, setSummary] = useState(existingDiary?.summary || '')
    const [moodKey, setMoodKey] = useState<MoodKey | undefined>(existingDiary?.moodKey as MoodKey)
    const [moodScore, setMoodScore] = useState(existingDiary?.moodScore || 5)
    const [loading, setLoading] = useState(false)

    const snapPoints = useMemo(() => ['40%', '70%'], [])

    useImperativeHandle(
      ref,
      () => ({
        present: () => sheetRef.current?.present(),
        dismiss: () => sheetRef.current?.dismiss(),
      }),
      []
    )

    useEffect(() => {
      if (existingDiary) {
        setSummary(existingDiary.summary || '')
        setMoodKey(existingDiary.moodKey as MoodKey)
        setMoodScore(existingDiary.moodScore || 5)
      }
    }, [existingDiary])

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.35}
          pressBehavior="close"
        />
      ),
      []
    )

    const handleConfirm = async () => {
      if (selectedMemos.length === 0) {
        toast.error(i18n.t('archive.selectMemo'))
        return
      }

      setLoading(true)
      try {
        await diariesApi.createOrUpdate(targetDate, {
          summary,
          moodKey: (moodKey || 'neutral') as any,
          moodScore,
        })

        for (const memo of selectedMemos) {
          await memosApi.archive(memo.id, targetDate)
        }

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['memos'] }),
          queryClient.invalidateQueries({ queryKey: ['diaries'] }),
          queryClient.invalidateQueries({ queryKey: ['diary', targetDate] }),
        ])

        sheetRef.current?.dismiss()
        onSuccess()
      } catch (error) {
        console.error(i18n.t('archive.failedLog'), error)
        toast.error(i18n.t('archive.failed'))
      } finally {
        setLoading(false)
      }
    }

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        onDismiss={onDismiss} // 唯一触发父组件状态更新的地方，确保动画完成再更新
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: theme.background }}
        handleIndicatorStyle={{ backgroundColor: theme.textSecondary }}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        enableBlurKeyboardOnGesture
        android_keyboardInputMode="adjustResize"
      >
        <BottomSheetScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.info}>
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              {i18n.t('archive.dialogInfo', { count: selectedMemos.length, date: targetDate })}
            </Text>
          </View>

          <View style={styles.summarySection}>
            <Text style={[styles.label, { color: theme.text }]}>
              {i18n.t('archive.diarySummary')}
            </Text>
            <BottomSheetTextInput
              placeholder={i18n.t('archive.moodPlaceholder')}
              value={summary}
              onChangeText={setSummary}
              multiline
              numberOfLines={3}
              style={[
                styles.summaryInput,
                {
                  backgroundColor: theme.surfaceMuted,
                  color: theme.text,
                  borderColor: 'transparent',
                },
              ]}
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View style={styles.moodSection}>
            <Text style={[styles.label, { color: theme.text }]}>{i18n.t('archive.mood')}</Text>
            <View style={styles.moodSelector}>
              {MOODS.map(mood => (
                <TouchableOpacity
                  key={mood.key}
                  style={[
                    styles.moodOption,
                    { backgroundColor: mood.color },
                    moodKey === mood.key && {
                      borderColor: theme.text,
                      borderWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                  onPress={() => setMoodKey(mood.key)}
                >
                  <Text style={styles.moodLabelText}>{mood.label[0]}</Text>
                  <Text style={styles.moodLabelText}>{mood.label[1]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {moodKey && (
              <View style={styles.intensitySection}>
                <Text style={[styles.intensityLabel, { color: theme.textSecondary }]}>
                  {i18n.t('archive.intensity', { score: moodScore })}
                </Text>
                <MoodDragBar value={moodScore} onChange={setMoodScore} />
              </View>
            )}
          </View>
        </BottomSheetScrollView>

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <Button
            title={i18n.t('common.cancel')}
            variant="secondary"
            onPress={onCancel}
            style={styles.footerButton}
          />
          <Button
            title={loading ? i18n.t('common.archiving') : i18n.t('archive.confirm')}
            onPress={handleConfirm}
            loading={loading}
            disabled={loading}
            style={styles.footerButton}
          />
        </View>
      </BottomSheetModal>
    )
  }
)

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16 },
  contentContainer: { paddingTop: 16, paddingBottom: 8 },
  info: { marginBottom: 16 },
  infoText: { fontSize: 14 },
  summaryInput: {
    height: 100,
    borderRadius: 12,
    paddingHorizontal: 16,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  summarySection: { marginBottom: 4 },
  moodSection: { marginTop: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 12 },
  moodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  moodOption: {
    flex: 1,
    height: 40,
    borderRadius: 6,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodLabelText: { color: '#fff', fontWeight: '500', fontSize: 10, lineHeight: 12 },
  intensitySection: { marginBottom: 16 },
  intensityLabel: { fontSize: 14, marginBottom: 8 },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButton: { flex: 1 },
})
