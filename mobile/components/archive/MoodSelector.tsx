import { Input } from '@/components/ui'
import { MOODS, type MoodKey } from '@/constants/common'
import { useThemeStore } from '@/stores/theme-store'
import { useState } from 'react'
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

interface MoodSelectorProps {
  visible: boolean
  onClose: () => void
  onSubmit: (moodKey: MoodKey, summary: string) => void
  submitting?: boolean
}

export function MoodSelector({ visible, onClose, onSubmit, submitting }: MoodSelectorProps) {
  const { theme } = useThemeStore()
  const [selectedMood, setSelectedMood] = useState<MoodKey | null>(null)
  const [summary, setSummary] = useState('')

  const handleSubmit = () => {
    if (selectedMood) {
      onSubmit(selectedMood, summary)
    }
  }

  const handleClose = () => {
    setSelectedMood(null)
    setSummary('')
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: theme.card }]}>
          <Text style={[styles.title, { color: theme.text }]}>选择心情</Text>
          <View style={styles.moodGrid}>
            {MOODS.map(mood => (
              <TouchableOpacity
                key={mood.key}
                style={[
                  styles.moodItem,
                  selectedMood === mood.key && { backgroundColor: theme.primary + '20' },
                ]}
                onPress={() => setSelectedMood(mood.key)}
              >
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                <Text style={[styles.moodLabel, { color: theme.text }]}>{mood.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.summaryContainer}>
            <Input
              placeholder="今天过得怎么样？（可选）"
              value={summary}
              onChangeText={setSummary}
              multiline
            />
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.surface }]}
              onPress={handleClose}
            >
              <Text style={[styles.buttonText, { color: theme.text }]}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: theme.primary },
                (!selectedMood || submitting) && { opacity: 0.5 },
              ]}
              onPress={handleSubmit}
              disabled={!selectedMood || submitting}
            >
              <Text style={styles.confirmButtonText}>{submitting ? '提交中...' : '确认归档'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 8,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  moodItem: {
    width: '22%',
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  moodEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  moodLabel: {
    fontSize: 12,
  },
  summaryContainer: {
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
})
