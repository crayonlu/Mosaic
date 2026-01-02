/**
 * Input Editor Modal
 * Bottom sheet for creating/editing memos
 */

import { View, StyleSheet, TouchableOpacity, Text, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import { useThemeStore } from '@/stores/theme-store'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Spacing, BorderRadius, Shadows, layout, Typography } from '@/constants/theme'
import { router } from 'expo-router'

export default function InputEditorModal() {
  const { theme } = useThemeStore()

  const handleClose = () => {
    router.back()
  }

  const handleSave = () => {
    // TODO: Save memo logic
    router.back()
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <SafeAreaView style={[styles.content, { backgroundColor: theme.background }]} edges={['bottom']}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
              <Text style={[styles.headerButtonText, { color: theme.textSecondary }]}>取消</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.text }]}>新记录</Text>
            <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
              <Text style={[styles.headerButtonText, styles.saveButton, { color: theme.primaryDark }]}>保存</Text>
            </TouchableOpacity>
          </View>

          {/* Editor */}
          <View style={styles.editorContainer}>
            <TextInput
              style={[styles.editor, { color: theme.text }]}
              placeholder="记录你的想法..."
              placeholderTextColor={theme.textTertiary}
              multiline
              autoFocus
              // TODO: Add rich text editor
            />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    minHeight: layout.inputMaxHeight,
    maxHeight: '80%',
    ...Shadows.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: Spacing.sm,
  },
  headerButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: '500' as const,
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '600' as const,
  },
  saveButton: {
    fontWeight: '600' as const,
  },
  editorContainer: {
    flex: 1,
    padding: Spacing.md,
  },
  editor: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.base,
    textAlignVertical: 'top',
  },
})
