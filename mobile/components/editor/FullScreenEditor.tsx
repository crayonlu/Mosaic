import { stringUtils } from '@/lib/utils/string'
import { useThemeStore } from '@/stores/theme-store'
import { X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/ui'
import { RichTextEditor } from './RichTextEditor'

interface FullScreenEditorProps {
  visible: boolean
  initialContent?: string
  placeholder?: string
  onClose: () => void
  onSubmit: (content: string) => void
}

export function FullScreenEditor({
  visible,
  initialContent = '',
  placeholder = '记录你的想法...',
  onClose,
  onSubmit,
}: FullScreenEditorProps) {
  const { theme } = useThemeStore()
  const [content, setContent] = useState(initialContent)

  useEffect(() => {
    if (visible) {
      setContent(initialContent)
    }
  }, [visible, initialContent])

  const handleSubmit = () => {
    const textContent = stringUtils.extractTextFromHtml(content)
    if (textContent) {
      onSubmit(content)
      setContent('')
      onClose()
    }
  }

  const handleClose = () => {
    setContent('')
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
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
            <Text style={[styles.headerTitle, { color: theme.text }]}>创建MEMO</Text>
            <View style={styles.closeButton} />
          </View>

          <View style={styles.editorContainer}>
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder={placeholder}
              editable={true}
              onSave={handleSubmit}
              isExpanded={true}
              showCreateButton={false}
            />
          </View>
        </KeyboardAvoidingView>

        <View style={[styles.createButtonContainer, { backgroundColor: theme.background }]}>
          <Button
            title="创建"
            onPress={handleSubmit}
            variant="primary"
            size="large"
            fullWidth={true}
            disabled={stringUtils.extractTextFromHtml(content).length === 0}
          />
        </View>
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
    paddingVertical: 8,
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
  editorContainer: {
    flex: 1,
  },
  createButtonContainer: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexShrink: 1,
  },
})
