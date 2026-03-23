import { Button, Loading, toast } from '@/components/ui'
import type { MediaGridItem } from '@/components/ui/DraggableImageGrid'
import { DraggableImageGrid } from '@/components/ui/DraggableImageGrid'
import { useAISummary } from '@/hooks/useAISummary'
import { useConnection } from '@/hooks/useConnection'
import {
  createSelectedMediaItems,
  uploadSelectedMedia,
  type SelectedMediaItem,
} from '@/lib/media/upload'
import { normalizeContent } from '@/lib/utils/content'
import { useThemeStore } from '@/stores/themeStore'
import { Share as ShareIcon, Sparkles, X } from 'lucide-react-native'
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
  initialAISummary?: string
  placeholder?: string
  availableTags?: string[]
  onClose: () => void
  onSubmit: (content: string, tags: string[], resources: string[], aiSummary?: string) => void
}

export function FullScreenEditor({
  visible,
  initialContent = '',
  initialTags = [],
  initialAISummary,
  placeholder = "What's on your mind?",
  availableTags = [],
  onClose,
  onSubmit,
}: FullScreenEditorProps) {
  const { theme } = useThemeStore()
  const insets = useSafeAreaInsets()
  const { canUseNetwork } = useConnection()
  const {
    summary,
    loading: summaryLoading,
    summarize,
    clear: clearSummary,
    error: summaryError,
    disabled: summaryDisabled,
  } = useAISummary()
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
      if (initialAISummary) {
        // Set initial AI summary if provided (for editing existing memo)
        // Note: This would need a separate setter in useAISummary hook
      }
      clearSummary()
    }
  }, [visible, initialContent, initialTags, clearSummary, initialAISummary])

  const handleSummarize = useCallback(async () => {
    const normalized = normalizeContent(content)
    if (normalized) await summarize(normalized)
  }, [content, summarize])

  const handleCopySummary = useCallback(async () => {
    if (summary) {
      try {
        const { Share } = await import('react-native')
        await Share.share({ message: summary })
      } catch (error) {
        console.log('Share failed:', error)
      }
    }
  }, [summary])

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

    onSubmit(content, tags, uploadedResourceIds, summary || undefined)
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
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={handleSummarize}
                style={styles.summarizeButton}
                disabled={summaryDisabled || !normalizeContent(content) || summaryLoading}
              >
                {summaryLoading ? (
                  <Loading size="small" />
                ) : (
                  <Sparkles
                    size={16}
                    color={
                      summaryDisabled || !normalizeContent(content)
                        ? theme.textSecondary
                        : theme.primary
                    }
                  />
                )}
              </TouchableOpacity>
              <Button onPress={handlePickMedia} variant="ghost" size="medium" title="上传" />
              <Button
                title="预览"
                onPress={() => setShowPreview(true)}
                variant="ghost"
                size="medium"
                disabled={!normalizeContent(content) && mediaItems.length === 0}
              />
              <Button
                title="创建"
                onPress={handleSubmit}
                variant="ghost"
                size="medium"
                disabled={
                  (!normalizeContent(content) && mediaItems.length === 0) ||
                  !canUseNetwork ||
                  uploading
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

            {summary && (
              <View style={styles.summaryContainer}>
                <View style={styles.summaryHeader}>
                  <Text style={[styles.summaryTitle, { color: theme.text }]}>AI 摘要</Text>
                  <View style={styles.summaryActions}>
                    <TouchableOpacity
                      onPress={handleCopySummary}
                      style={styles.summaryActionButton}
                    >
                      <ShareIcon size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={clearSummary} style={styles.summaryActionButton}>
                      <X size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={[styles.summaryText, { color: theme.textSecondary }]}>{summary}</Text>
              </View>
            )}

            {summaryError && (
              <View style={styles.errorContainer}>
                <Text style={[styles.errorText, { color: '#FF3B30' }]}>{summaryError}</Text>
              </View>
            )}
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
  summarizeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(120, 120, 120, 0.1)',
    borderRadius: 8,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
  },
  summaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryActionButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
  },
})
