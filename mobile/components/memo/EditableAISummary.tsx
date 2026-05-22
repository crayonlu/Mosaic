import { toast } from '@/components/ui/Toast'
import { useThemeStore } from '@/stores/themeStore'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { Easing, FadeIn } from 'react-native-reanimated'

interface EditableAISummaryProps {
  summary: string
  onSave: (newSummary: string) => Promise<void>
}

export function EditableAISummary({ summary, onSave }: EditableAISummaryProps) {
  const { theme } = useThemeStore()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(summary)
  const [saving, setSaving] = useState(false)

  // Sync draft when summary changes externally (e.g. after save completes and query re-fetches)
  useEffect(() => {
    if (!isEditing) {
      setDraft(summary)
    }
  }, [summary, isEditing])

  const handleEdit = useCallback(() => {
    setDraft(summary)
    setIsEditing(true)
  }, [summary])

  const handleCancel = useCallback(() => {
    setDraft(summary)
    setIsEditing(false)
  }, [summary])

  const handleSave = useCallback(async () => {
    const trimmed = draft.trim()
    if (trimmed === summary) {
      setIsEditing(false)
      return
    }

    setSaving(true)
    try {
      await onSave(trimmed)
      setIsEditing(false)
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }, [draft, summary, onSave])

  return (
    <Animated.View
      entering={FadeIn.duration(200).easing(Easing.out(Easing.cubic))}
      style={[
        styles.container,
        {
          backgroundColor: theme.surfaceMuted,
          borderRadius: theme.radius.medium,
        },
      ]}
    >
      <Text style={[styles.title, { color: theme.textSecondary }]}>AI 摘要</Text>

      {isEditing ? (
        <View style={styles.editArea}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            textAlignVertical="top"
            autoFocus
            style={[
              styles.textInput,
              {
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholderTextColor={theme.textTertiary}
            placeholder="输入摘要内容..."
          />
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={handleCancel}
              style={[styles.actionButton, { backgroundColor: theme.surface }]}
              disabled={saving}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionButtonText, { color: theme.textSecondary }]}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
              disabled={saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.actionButtonText, { color: '#fff' }]}>保存</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Pressable onPress={handleEdit}>
          <Text style={[styles.summaryText, { color: theme.text }]}>{summary}</Text>
        </Pressable>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
  },
  editArea: {
    gap: 8,
  },
  textInput: {
    fontSize: 14,
    lineHeight: 20,
    minHeight: 72,
    borderWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
})
