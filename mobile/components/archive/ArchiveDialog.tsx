import { MoodDragBar } from '@/components/diary/MoodDragBar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'
import { MOODS, type MoodKey } from '@mosaic/utils'
import { type DiaryResponse, type MemoWithResources } from '@mosaic/api'
import { diariesApi, memosApi } from '@mosaic/api'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  Animated,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { CoverImagePicker } from './CoverImagePicker'

interface ArchiveDialogProps {
  visible: boolean
  selectedMemos: MemoWithResources[]
  targetDate: string
  existingDiary?: DiaryResponse
  onSuccess: () => void
  onCancel: () => void
}

export function ArchiveDialog({
  visible,
  selectedMemos,
  targetDate,
  existingDiary,
  onSuccess,
  onCancel,
}: ArchiveDialogProps) {
  const { theme } = useThemeStore()
  const queryClient = useQueryClient()
  const [summary, setSummary] = useState(existingDiary?.summary || '')
  const [moodKey, setMoodKey] = useState<MoodKey | undefined>(existingDiary?.moodKey as MoodKey)
  const [moodScore, setMoodScore] = useState(existingDiary?.moodScore || 5)
  const [coverImageId, setCoverImageId] = useState<string | undefined>(existingDiary?.coverImageId)
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (selectedMemos.length === 0) {
      toast.error('请选择至少一条Memo')
      return
    }

    setLoading(true)
    try {
      await diariesApi.create(targetDate, {
        summary,
        moodKey: (moodKey || 'neutral') as any,
        moodScore,
        coverImageId,
      })

      for (const memo of selectedMemos) {
        await memosApi.archive(memo.id, targetDate)
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['memos'] }),
        queryClient.invalidateQueries({ queryKey: ['diaries'] }),
        queryClient.invalidateQueries({ queryKey: ['diary', targetDate] }),
      ])

      toast.success('归档成功')
      onSuccess()
    } catch (error) {
      console.error('归档失败:', error)
      toast.error('归档失败')
    } finally {
      setLoading(false)
    }
  }

  const [keyboardHeight] = useState(() => new Animated.Value(0))

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const onShow = (e: { endCoordinates: { height: number }; duration?: number }) => {
      Animated.timing(keyboardHeight, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === 'ios' ? (e.duration ?? 250) : 150,
        useNativeDriver: false,
      }).start()
    }
    const onHide = (e?: { duration?: number }) => {
      Animated.timing(keyboardHeight, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? (e?.duration ?? 250) : 150,
        useNativeDriver: false,
      }).start()
    }

    const sub1 = Keyboard.addListener(showEvent, onShow)
    const sub2 = Keyboard.addListener(hideEvent, onHide)
    return () => {
      sub1.remove()
      sub2.remove()
    }
  }, [keyboardHeight])

  const allImages = selectedMemos.flatMap(memo =>
    memo.resources.filter(r => r.resourceType === 'image')
  )

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]}>归档Memo</Text>
            <Pressable onPress={onCancel}>
              <Text style={[styles.cancelButton, { color: theme.primary }]}>取消</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.info}>
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                将 {selectedMemos.length} 条Memo归档到 {targetDate}
              </Text>
            </View>

            <Input
              label="日记总结（可选）"
              placeholder="写下今天的心情或总结..."
              value={summary}
              onChangeText={setSummary}
              multiline
              numberOfLines={3}
              style={styles.summaryInput}
            />

            <View style={styles.moodSection}>
              <Text style={[styles.label, { color: theme.text }]}>心情</Text>
              <View style={styles.moodSelector}>
                {MOODS.map(mood => (
                  <TouchableOpacity
                    key={mood.key}
                    style={[
                      styles.moodOption,
                      { backgroundColor: mood.color },
                      moodKey === mood.key && {
                        borderColor: theme.text,
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
                    强度: {moodScore}/10
                  </Text>
                  <MoodDragBar value={moodScore} onChange={setMoodScore} />
                </View>
              )}
            </View>

            {allImages.length > 0 && (
              <CoverImagePicker
                memos={selectedMemos}
                selectedCoverId={coverImageId}
                onSelect={setCoverImageId}
                onClear={() => setCoverImageId(undefined)}
              />
            )}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <Button
              title="取消"
              variant="secondary"
              onPress={onCancel}
              style={styles.footerButton}
            />
            <Button
              title={loading ? '归档中...' : '确认归档'}
              onPress={handleConfirm}
              loading={loading}
              disabled={loading}
              style={styles.footerButton}
            />
          </View>
        </View>
        <Animated.View style={{ height: keyboardHeight }} />
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    justifyContent: 'flex-end',
  },
  container: {
    maxHeight: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    fontSize: 16,
  },
  content: {
    padding: 16,
  },
  info: {
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
  },
  summaryInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  moodSection: {
    marginTop: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
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
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodLabelText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 10,
    lineHeight: 12,
  },
  intensitySection: {
    marginBottom: 16,
  },
  intensityLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  footerButton: {
    flex: 1,
  },
})
