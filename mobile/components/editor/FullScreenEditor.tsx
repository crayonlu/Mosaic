import { Button, toast } from '@/components/ui'
import { DraggableImageGrid } from '@/components/ui/DraggableImageGrid'
import { useConnection } from '@/hooks/use-connection'
import { useThemeStore } from '@/stores/theme-store'
import { resourcesApi } from '@mosaic/api'
import { Image, X } from 'lucide-react-native'
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
import { PostPreview } from './PostPreview'
import { TextEditor } from './TextEditor'
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
  placeholder = 'What\'s on your mind?',
  availableTags = [],
  onClose,
  onSubmit,
}: FullScreenEditorProps) {
  const { theme } = useThemeStore()
  const { canUseNetwork } = useConnection()
  const [content, setContent] = useState(initialContent)
  const [tags, setTags] = useState<string[]>(initialTags)
  const [resources, setResources] = useState<string[]>([])
  const [imageUris, setImageUris] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    if (visible) {
      setContent(initialContent)
      setTags(initialTags)
      setResources([])
      setImageUris([])
    }
  }, [visible, initialContent, initialTags])

  const handlePickImage = async () => {
    const result = await selectImages()
    if (result.length > 0) {
      setImageUris([...imageUris, ...result].slice(0, 9))
    }
  }

  const handleSubmit = async () => {
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
        console.error('Image upload failed:', error)
        toast.error('Error', 'Image upload failed')
        setUploading(false)
        return
      }
      setUploading(false)
    }

    onSubmit(content, tags, uploadedResources)
    handleClose()
  }

  const handleClose = () => {
    setContent('')
    setTags([])
    setResources([])
    setImageUris([])
    onClose()
  }

  const handlePost = async () => {
    setShowPreview(false)
    await handleSubmit()
  }

  const selectImages = async () => {
    const { launchImageLibraryAsync } = await import('expo-image-picker')
    const result = await launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    })

    if (!result.canceled) {
      return result.assets.map(asset => asset.uri)
    }
    return []
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
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={theme.text} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Memo</Text>
            <View style={styles.headerActions}>
              <Button
                onPress={handlePickImage}
                variant="ghost"
                size="medium"
                leftIcon={<Image size={16} color={theme.text} />}
              />
              <Button
                title="预览"
                onPress={() => setShowPreview(true)}
                variant="ghost"
                size="medium"
                disabled={!content.trim() && imageUris.length === 0}
              />
              <Button
                title="创建"
                onPress={handleSubmit}
                variant="ghost"
                size="medium"
                disabled={(!content.trim() && imageUris.length === 0) || !canUseNetwork || uploading}
              />
            </View>
          </View>

          <ScrollView style={styles.contentContainer}>
            <View style={styles.tagContainer}>
              <TagInput
                tags={tags}
                onTagsChange={setTags}
                content={content}
                suggestions={availableTags}
                placeholder="添加标签..."
              />
            </View>

            <View style={styles.editorContainer}>
              <TextEditor
                value={content}
                onChange={setContent}
                placeholder={placeholder}
              />
            </View>

            {imageUris.length > 0 && (
              <View style={styles.imageContainer}>
                <DraggableImageGrid
                  images={imageUris}
                  onImagesChange={setImageUris}
                  maxImages={9}
                  onAddImage={handlePickImage}
                />
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        <PostPreview
          visible={showPreview}
          content={content}
          images={imageUris}
          tags={tags}
          onClose={() => setShowPreview(false)}
          onPost={handlePost}
        />
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
  contentContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  tagContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  editorContainer: {
    flexShrink: 0,
    minHeight: 150,
  },
  imageContainer: {
    padding: 8,
  },
  footer: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  footerButton: {
    padding: 8,
  },
})
