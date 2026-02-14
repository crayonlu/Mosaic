import { MoodDragBar } from '@/components/diary/MoodDragBar'
import { MOODS, type MoodKey } from '@/constants/common'
import { useThemeStore } from '@/stores/theme-store'
import React from 'react'
import { Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native'

interface MoodDialogProps {
  visible: boolean
  onClose: () => void
  title?: string
  initialMood?: MoodKey | null
  initialIntensity?: number
  onSubmit: (moodKey: MoodKey, intensity: number) => void
  submitting?: boolean
  showIntensity?: boolean
}

export function MoodDialog({
  visible,
  onClose,
  title = '编辑心情',
  initialMood = null,
  initialIntensity = 5,
  onSubmit,
  submitting = false,
  showIntensity = true,
}: MoodDialogProps) {
  const { theme } = useThemeStore()
  const [selectedMood, setSelectedMood] = React.useState<MoodKey | null>(initialMood)
  const [intensity, setIntensity] = React.useState(initialIntensity)

  React.useEffect(() => {
    if (visible) {
      setSelectedMood(initialMood)
      setIntensity(initialIntensity)
    }
  }, [visible, initialMood, initialIntensity])

  const handleSubmit = () => {
    if (selectedMood) {
      onSubmit(selectedMood, intensity)
    }
  }

  const handleClose = () => {
    setSelectedMood(null)
    setIntensity(5)
    onClose()
  }

  const handleMoodChange = (moodKey: MoodKey) => {
    setSelectedMood(moodKey)
  }

  const isDisabled = !selectedMood || submitting

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.dialogOverlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.dialogContent, { backgroundColor: theme.surface }]}>
              <Text style={[styles.dialogTitle, { color: theme.text }]}>{title}</Text>

              {/* Mood Selection */}
              <Text style={[styles.dialogLabel, { color: theme.textSecondary }]}>选择心情</Text>
              <View style={styles.dialogMoodSelector}>
                {MOODS.map(mood => (
                  <TouchableOpacity
                    key={mood.key}
                    style={[
                      styles.dialogMoodOption,
                      { backgroundColor: mood.color },
                      selectedMood === mood.key && {
                        borderColor: theme.text,
                      },
                    ]}
                    onPress={() => handleMoodChange(mood.key)}
                  >
                    <Text style={styles.moodLabelText}>{mood.label[0]}</Text>
                    <Text style={styles.moodLabelText}>{mood.label[1]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Intensity Section */}
              {showIntensity && selectedMood && (
                <View style={styles.dialogIntensitySection}>
                  <Text style={[styles.dialogLabel, { color: theme.textSecondary }]}>
                    强度: {intensity}/10
                  </Text>
                  <MoodDragBar
                    value={intensity}
                    onChange={setIntensity}
                    disabled={submitting}
                  />
                </View>
              )}

              {/* Actions */}
              <View style={styles.dialogActions}>
                <TouchableOpacity
                  style={[styles.dialogButton, { backgroundColor: theme.border }]}
                  onPress={handleClose}
                >
                  <Text style={[styles.dialogButtonText, { color: theme.text }]}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.dialogButton,
                    { backgroundColor: theme.primary },
                    isDisabled && styles.dialogButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={isDisabled}
                >
                  <Text style={[styles.dialogButtonText, { color: '#fff' }]}>
                    {submitting ? '保存中...' : '保存'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  )
}

const styles = StyleSheet.create({
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
  moodLabelText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 14,
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
