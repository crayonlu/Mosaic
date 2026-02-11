import { Button, toast } from '@/components/ui'
import { useConnection } from '@/hooks/use-connection'
import { resourcesApi } from '@/lib/api/resources'
import { useThemeStore } from '@/stores/theme-store'
import * as ImagePicker from 'expo-image-picker'
import { Parser } from 'htmlparser2'
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
import { TagInput } from '../tag/TagInput'
import { RichTextEditor } from './RichTextEditor'

interface FullScreenEditorProps {
  visible: boolean
  initialContent?: string
  initialTags?: string[]
  placeholder?: string
  availableTags?: string[]
  onClose: () => void
  onSubmit: (content: string, tags: string[], resources: string[]) => void
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
  const { canUseNetwork } = useConnection()
  const [content, setContent] = useState(initialContent)
  const [tags, setTags] = useState<string[]>(initialTags)
  const [resources, setResources] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [resourceUrls, setResourceUrls] = useState<Map<string, string>>(new Map())
  const [textContent, setTextContent] = useState('')

  useEffect(() => {
    if (visible) {
      setContent(initialContent)
      setTags(initialTags)
      setResources([])
      setResourceUrls(new Map())
      extractTextFromHtml(initialContent).then(setTextContent)
    }
  }, [visible, initialContent, initialTags])

  useEffect(() => {
    extractTextFromHtml(content).then(setTextContent)
  }, [content])

  const handleSubmit = async () => {
    if (textContent) {
      onSubmit(content, tags, resources)
      setContent('')
      setTags([])
      setResources([])
      setTextContent('')
      onClose()
    }
  }

  const handleClose = () => {
    setContent('')
    setTags([])
    setResources([])
    setTextContent('')
    onClose()
  }

  const extractTextFromHtml = (html: string) => {
    return new Promise<string>(resolve => {
      let text = ''
      const parser = new Parser({
        ontext: chunk => {
          text += chunk
        },
        onend: () => {
          text = text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
          text = text.replace(/\s+/g, ' ').trim()
          resolve(text)
        },
      })
      parser.write(html)
      parser.end()
    })
  }

  const handleImagePick = async () => {
    if (!canUseNetwork) {
      toast.error('错误', '无网络连接')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      setUploading(true)
      try {
        const resource = await resourcesApi.upload(
          {
            uri: asset.uri,
            name: asset.fileName || `image_${Date.now()}.jpg`,
            type: asset.mimeType || 'image/jpeg',
          },
          'new'
        )
        setResources(prev => [...prev, resource.id])
        const imageUrl = await resourcesApi.getDownloadUrl(resource.id)
        setResourceUrls(prev => new Map(prev).set(resource.id, imageUrl))
        const imageHtml = `<img src="${imageUrl}" alt="uploaded image" style="max-width: 100%; border-radius: 8px; margin: 8px 0;" />`
        setContent(prev => prev + imageHtml)
      } catch (error) {
        console.error('Image upload error:', error)
        toast.error('错误', '图片上传失败')
      } finally {
        setUploading(false)
      }
    }
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
            <Button
              title="创建"
              onPress={handleSubmit}
              variant="ghost"
              size="large"
              disabled={textContent.length === 0 || !canUseNetwork}
            />
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
                content={textContent}
                suggestions={availableTags}
                placeholder="添加标签..."
              />
            </View>
          </ScrollView>
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
