import { Button } from '@/components/ui'
import { useThemeStore } from '@/stores/theme-store'
import { Link as LinkIcon, X } from 'lucide-react-native'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

interface LinkDialogProps {
  visible: boolean
  onClose: () => void
  onInsert: (url: string, text: string) => void
  initialUrl?: string
  initialText?: string
}

export function LinkDialog({
  visible,
  onClose,
  onInsert,
  initialUrl = '',
  initialText = '',
}: LinkDialogProps) {
  const { theme } = useThemeStore()
  const [url, setUrl] = useState(initialUrl)
  const [text, setText] = useState(initialText)

  const handleInsert = () => {
    if (url.trim()) {
      onInsert(url.trim(), text.trim())
      setUrl('')
      setText('')
      onClose()
    }
  }

  const handleClose = () => {
    setUrl('')
    setText('')
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top', 'left', 'right', 'bottom']}
      >
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Header */}
          <View
            style={[
              styles.header,
              {
                borderBottomColor: theme.border,
              },
            ]}
          >
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={24} color={theme.text} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.text }]}>插入链接</Text>
            <View style={styles.closeButton} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* URL Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>链接地址</Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <LinkIcon size={20} color={theme.textSecondary} strokeWidth={2} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="https://example.com"
                  placeholderTextColor={theme.textSecondary}
                  value={url}
                  onChangeText={setUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>
            </View>

            {/* Text Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>显示文字</Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="链接文字（可选）"
                  placeholderTextColor={theme.textSecondary}
                  value={text}
                  onChangeText={setText}
                />
              </View>
            </View>

            {/* Preview */}
            {url.trim() && (
              <View
                style={[
                  styles.preview,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>预览</Text>
                <Text style={[styles.previewText, { color: theme.primary }]} numberOfLines={2}>
                  {text.trim() || url}
                </Text>
              </View>
            )}
          </View>

          {/* Footer */}
          <View
            style={[
              styles.footer,
              {
                borderTopColor: theme.border,
                backgroundColor: theme.background,
              },
            ]}
          >
            <Button
              title="取消"
              onPress={handleClose}
              variant="secondary"
              size="large"
              style={styles.footerButton}
            />
            <Button
              title="插入"
              onPress={handleInsert}
              variant="primary"
              size="large"
              style={styles.footerButton}
              disabled={!url.trim()}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  preview: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  previewLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  previewText: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  footerButton: {
    flex: 1,
  },
})
