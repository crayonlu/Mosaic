import { Button, toast } from '@/components/ui'
import { ImagePicker as CustomImagePicker } from '@/components/ui/ImagePicker'
import { useConnection } from '@/hooks/use-connection'
import { resourcesApi } from '@/lib/api/resources'
import { useThemeStore } from '@/stores/theme-store'
import { Parser } from 'htmlparser2'
import { Upload, X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
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
  const [textContent, setTextContent] = useState('')
  const [imageUris, setImageUris] = useState<string[]>([])
  const [triggerUpload, setTriggerUpload] = useState(0)

  useEffect(() => {
    if (visible) {
      setContent(initialContent)
      setTags(initialTags)
      setResources([])
      setImageUris([])
      extractTextFromHtml(initialContent).then(setTextContent)
    }
  }, [visible, initialContent, initialTags])

  useEffect(() => {
    extractTextFromHtml(content).then(setTextContent)
  }, [content])

  const handleSubmit = async () => {
    if (textContent || imageUris.length > 0) {
      // Upload all images before submitting
      const uploadedResources = [...resources]
      if (imageUris.length > 0 && canUseNetwork) {
        setUploading(true)
        try {
          for (const uri of imageUris) {
            const resource = await resourcesApi.upload(
              {
                uri,
                name: `image_${Date.now()}.jpg`,
                type: 'image/jpeg',
              },
              'new'
            )
            uploadedResources.push(resource.id)
          }
        } catch (error) {
          console.error('Image upload error:', error)
          toast.error('错误', '图片上传失败')
          setUploading(false)
          return
        }
        setUploading(false)
      }
      
      onSubmit(content, tags, uploadedResources)
      setContent('')
      setTags([])
      setResources([])
      setImageUris([])
      setTextContent('')
      onClose()
    }
  }

  const handleClose = () => {
    setContent('')
    setTags([])
    setResources([])
    setImageUris([])
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

  const handleImagesChange = (newImages: string[]) => {
    setImageUris(newImages)
  }

  const handleUploadClick = () => {
    setTriggerUpload(prev => prev + 1)
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
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={handleUploadClick}
                style={styles.uploadButton}
                disabled={uploading}
              >
                <Upload size={20} color={theme.primary} />
              </TouchableOpacity>
              <Button
                title="创建"
                onPress={handleSubmit}
                variant="ghost"
                size="medium"
                disabled={(textContent.length === 0 && imageUris.length === 0) || !canUseNetwork || uploading}
              />
            </View>
          </View>

          <View style={styles.contentContainer}>
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

            <View style={styles.imageContainer}>
              <CustomImagePicker
                images={imageUris}
                onImagesChange={handleImagesChange}
                maxImages={9}
                showUploadButton={false}
                triggerUpload={triggerUpload}
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
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  editorContainer: {
    flex: 1,
  },
  imageContainer: {
    paddingHorizontal: 16,
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
