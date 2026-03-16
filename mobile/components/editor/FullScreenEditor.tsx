import { Button, toast } from '@/components/ui'
import type { MediaGridItem } from '@/components/ui/DraggableImageGrid'
import { DraggableImageGrid } from '@/components/ui/DraggableImageGrid'
import { useConnection } from '@/hooks/useConnection'
import {
  createSelectedMediaItems,
  uploadSelectedMedia,
  type SelectedMediaItem,
} from '@/lib/media/upload'
import { useThemeStore } from '@/stores/themeStore'
import { X } from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
  placeholder = "What's on your mind?",
  availableTags = [],
  onClose,
  onSubmit,
}: FullScreenEditorProps) {
  const { theme } = useThemeStore()
  const insets = useSafeAreaInsets()
  const { canUseNetwork } = useConnection()
  const [content, setContent] = useState(initialContent)
  const [tags, setTags] = useState<string[]>(initialTags)
  const [resources, setResources] = useState<string[]>([])
  const [mediaItems, setMediaItems] = useState<SelectedMediaItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgressItems, setUploadProgressItems] = useState<
    { id: string; name: string; type: 'image' | 'video'; progress: number }[]
  >([])
  const [showPreview, setShowPreview] = useState(false)
  const [isDraggingMedia, setIsDraggingMedia] = useState(false)
  const uploadProgressById = Object.fromEntries(
    uploadProgressItems.map(item => [item.id, item.progress])
  )

  useEffect(() => {
    if (visible) {
      setContent(initialContent)
      setTags(initialTags)
      setResources([])
      setMediaItems([])
      setUploadProgressItems([])
      setIsDraggingMedia(false)
    }
  }, [visible, initialContent, initialTags])

  const handleMediaItemsChange = useCallback((nextItems: MediaGridItem[]) => {
    setMediaItems(prev =>
      nextItems
        .map(item => prev.find(candidate => candidate.key === item.key))
        .filter((item): item is SelectedMediaItem => Boolean(item))
    )
  }, [])

  const selectMedia = async () => {
    const { launchImageLibraryAsync } = await import('expo-image-picker')
    const result = await launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.8,
    })

    if (result.canceled) {
      return []
    }

    return createSelectedMediaItems(result.assets)
  }

  const handlePickMedia = async () => {
    const selectedItems = await selectMedia()
    if (selectedItems.length > 0) {
      setMediaItems(prev => [...prev, ...selectedItems].slice(0, 9))
    }
  }

  const handleSubmit = async () => {
    const uploadedResourceIds = [...resources]
    if (mediaItems.length > 0 && canUseNetwork) {
      setUploadProgressItems(
        mediaItems.map(item => ({
          id: item.key,
          name: item.filename,
          type: item.type,
          progress: 0,
        }))
      )
      setUploading(true)
      try {
        const uploadedResources = await uploadSelectedMedia(mediaItems, {
          onFileProgress: (item, progress) => {
            setUploadProgressItems(prev =>
              prev.map(entry =>
                entry.id === item.key ? { ...entry, progress: progress.percent } : entry
              )
            )
          },
        })
        uploadedResourceIds.push(...uploadedResources.map(resource => resource.id))
      } catch (error) {
        console.error('Media upload failed:', error)
        toast.error('Error', 'Media upload failed')
        setUploading(false)
        setUploadProgressItems([])
        return
      }
      setUploading(false)
      setUploadProgressItems([])
    }

    onSubmit(content, tags, uploadedResourceIds)
    handleClose()
  }

  const handleClose = () => {
    setContent('')
    setTags([])
    setResources([])
    setMediaItems([])
    setUploadProgressItems([])
    onClose()
  }

  const handlePost = async () => {
    setShowPreview(false)
    await handleSubmit()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <KeyboardAvoidingView
          style={[
            styles.keyboardView,
            {
              paddingTop: insets.top,
              paddingRight: insets.right,
              paddingBottom: insets.bottom,
              paddingLeft: insets.left,
            },
          ]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={[styles.header]}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={theme.text} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Memo</Text>
            <View style={styles.headerActions}>
              <Button onPress={handlePickMedia} variant="ghost" size="medium" title="上传" />
              <Button
                title="预览"
                onPress={() => setShowPreview(true)}
                variant="ghost"
                size="medium"
                disabled={!content.trim() && mediaItems.length === 0}
              />
              <Button
                title="创建"
                onPress={handleSubmit}
                variant="ghost"
                size="medium"
                disabled={
                  (!content.trim() && mediaItems.length === 0) || !canUseNetwork || uploading
                }
              />
            </View>
          </View>

          <ScrollView style={styles.contentContainer} scrollEnabled={!isDraggingMedia}>
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
              <TextEditor value={content} onChange={setContent} placeholder={placeholder} />
            </View>

            <View style={styles.imageContainer}>
              {mediaItems.length > 0 && (
                <>
                  <Text style={[styles.mediaHint, { color: theme.textSecondary }]}>
                    长按图片拖拽调整顺序
                  </Text>
                  <DraggableImageGrid
                    items={mediaItems}
                    uploadProgressById={uploadProgressById}
                    onItemsChange={handleMediaItemsChange}
                    onDragActivate={() => setIsDraggingMedia(true)}
                    onDragStart={() => setIsDraggingMedia(true)}
                    onDragEnd={() => setIsDraggingMedia(false)}
                  />
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <PostPreview
          visible={showPreview}
          content={content}
          items={mediaItems}
          tags={tags}
          onClose={() => setShowPreview(false)}
          onPost={handlePost}
        />
      </View>
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
  mediaHint: {
    fontSize: 12,
    marginBottom: 8,
    paddingHorizontal: 4,
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
