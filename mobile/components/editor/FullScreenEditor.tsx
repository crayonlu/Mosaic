import { TagInput } from '@/components/tag/TagInput'
import { Button } from '@/components/ui'
import { stringUtils } from '@/lib/utils/string'
import { useThemeStore } from '@/stores/theme-store'
import { X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RichTextEditor } from './RichTextEditor'

interface FullScreenEditorProps {
  visible: boolean
  initialContent?: string
  initialTags?: string[]
  placeholder?: string
  availableTags?: string[]
  onClose: () => void
  onSubmit: (content: string, tags: string[]) => void
}

export function FullScreenEditor({
  visible,
  initialContent = '',
  initialTags = [],
  placeholder = '记录你的想法...',
  availableTags = [],
  onClose,
  onSubmit,
}: FullScreenEditorProps) {
  const { theme } = useThemeStore()
  const [content, setContent] = useState(initialContent)
  const [tags, setTags] = useState<string[]>(initialTags)

  useEffect(() => {
    if (visible) {
      setContent(initialContent)
      setTags(initialTags)
    }
  }, [visible, initialContent, initialTags])

  const handleSubmit = () => {
    const textContent = stringUtils.extractTextFromHtml(content)
    if (textContent) {
      onSubmit(content, tags)
      setContent('')
      setTags([])
      onClose()
    }
  }

  const handleClose = () => {
    setContent('')
    setTags([])
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
          <View style={[styles.header]}>
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

          <ScrollView style={styles.contentContainer} keyboardShouldPersistTaps="handled">
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

            <View style={styles.tagContainer}>
              <TagInput
                tags={tags}
                onTagsChange={setTags}
                suggestions={availableTags}
                placeholder="添加标签..."
              />
            </View>
          </ScrollView>
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
  contentContainer: {
    flex: 1,
  },
  editorContainer: {
    minHeight: 200,
  },
  tagContainer: {
    padding: 16,
  },
  createButtonContainer: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexShrink: 1,
  },
})
