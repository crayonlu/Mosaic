import { Loading, toast } from '@/components/ui'
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
import { Share as ShareIcon, X } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
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

const EMPTY_TAGS: string[] = []
const EMPTY_MEDIA_ITEMS: MediaGridItem[] = []
const EMPTY_RESOURCE_IDS: string[] = []

interface FullScreenEditorProps {
  visible: boolean
  initialContent?: string
  initialTags?: string[]
  initialAISummary?: string
  initialMediaItems?: MediaGridItem[]
  initialResourceIds?: string[]
  uploadMemoId?: string
  title?: string
  submitLabel?: string
  placeholder?: string
  availableTags?: string[]
  onClose: () => void
  onSubmit: (content: string, tags: string[], resources: string[], aiSummary?: string) => void
}

export function FullScreenEditor({
  visible,
  initialContent = '',
  initialTags = EMPTY_TAGS,
  initialAISummary,
  initialMediaItems = EMPTY_MEDIA_ITEMS,
  initialResourceIds = EMPTY_RESOURCE_IDS,
  uploadMemoId,
  title = 'Memo',
  submitLabel = '创建',
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
  const [mediaItems, setMediaItems] = useState<MediaGridItem[]>(initialMediaItems)
  const [uploadCandidates, setUploadCandidates] = useState<Record<string, SelectedMediaItem>>({})
  const [uploading, setUploading] = useState(false)
  const [uploadProgressItems, setUploadProgressItems] = useState<
    { id: string; name: string; type: 'image' | 'video'; progress: number }[]
  >([])
  const [showPreview, setShowPreview] = useState(false)
  const [isDraggingMedia, setIsDraggingMedia] = useState(false)
  const wasVisibleRef = useRef(false)
  const uploadProgressById = Object.fromEntries(
    uploadProgressItems.map(item => [item.id, item.progress])
  )

  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      setContent(initialContent)
      setTags(initialTags)
      setMediaItems(initialMediaItems)
      setUploadCandidates({})
      setUploadProgressItems([])
      setIsDraggingMedia(false)
      setShowPreview(false)
      if (initialAISummary) {
        // Set initial AI summary if provided (for editing existing memo)
        // Note: This would need a separate setter in useAISummary hook
      }
      clearSummary()
    }

    if (!visible && wasVisibleRef.current) {
      setShowPreview(false)
    }

    wasVisibleRef.current = visible
  }, [visible, initialContent, initialTags, initialMediaItems, clearSummary, initialAISummary])

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
    setMediaItems(nextItems)
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
      const selectedById = Object.fromEntries(selectedItems.map(item => [item.key, item]))
      setUploadCandidates(prev => ({ ...prev, ...selectedById }))
      setMediaItems(prev => [...prev, ...selectedItems].slice(0, 9))
    }
  }

  const handleSubmit = async () => {
    const visibleKeys = new Set(mediaItems.map(item => item.key))
    const keptResourceIds = initialResourceIds.filter(resourceId => visibleKeys.has(resourceId))
    const pendingUploadItems = mediaItems
      .map(item => uploadCandidates[item.key])
      .filter((item): item is SelectedMediaItem => Boolean(item))

    const uploadedResourceIds: string[] = []
    if (pendingUploadItems.length > 0 && canUseNetwork) {
      setUploadProgressItems(
        pendingUploadItems.map(item => ({
          id: item.key,
          name: item.filename,
          type: item.type,
          progress: 0,
        }))
      )
      setUploading(true)
      try {
        const uploadedResources = await uploadSelectedMedia(pendingUploadItems, {
          memoId: uploadMemoId,
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

    onSubmit(content, tags, [...keptResourceIds, ...uploadedResourceIds], summary || undefined)
    handleClose()
  }

  const handleClose = () => {
    setContent('')
    setTags([])
    setMediaItems([])
    setUploadCandidates({})
    setUploadProgressItems([])
    onClose()
  }

  const handlePost = async () => {
    setShowPreview(false)
    await handleSubmit()
  }

  const hasContent = Boolean(normalizeContent(content) || mediaItems.length > 0)
  const canSummarize = !summaryDisabled && Boolean(normalizeContent(content))
  const canSubmit = hasContent && canUseNetwork && !uploading

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
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.headerTextButton}
                activeOpacity={theme.state.pressedOpacity}
              >
                <Text style={[styles.headerTextButtonLabel, { color: theme.textSecondary }]}>
                  取消
                </Text>
              </TouchableOpacity>

              <Text style={[styles.headerTitle, { color: theme.text }]}>{title}</Text>

              <TouchableOpacity
                onPress={handleSubmit}
                style={styles.headerTextButton}
                disabled={!canSubmit}
                activeOpacity={theme.state.pressedOpacity}
              >
                <Text
                  style={[
                    styles.headerTextButtonLabel,
                    {
                      color: canSubmit ? theme.primary : theme.textTertiary,
                      opacity: canSubmit ? 1 : theme.state.disabledOpacity,
                    },
                  ]}
                >
                  {submitLabel}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.headerActions}
            >
              <TouchableOpacity
                onPress={handleSummarize}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: canSummarize ? theme.semantic.infoSoft : theme.surfaceMuted,
                    opacity: canSummarize && !summaryLoading ? 1 : theme.state.disabledOpacity,
                  },
                ]}
                disabled={!canSummarize || summaryLoading}
                activeOpacity={theme.state.pressedOpacity}
              >
                {summaryLoading ? <Loading size="small" /> : <></>}
                <Text
                  style={[
                    styles.actionButtonText,
                    { color: canSummarize ? theme.primary : theme.textSecondary },
                  ]}
                >
                  AI 摘要
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handlePickMedia}
                style={[styles.actionButton, { backgroundColor: theme.surfaceMuted }]}
                activeOpacity={theme.state.pressedOpacity}
              >
                <Text style={[styles.actionButtonText, { color: theme.text }]}>添加图片</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowPreview(true)}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: hasContent ? theme.surfaceMuted : theme.surface,
                    opacity: hasContent ? 1 : theme.state.disabledOpacity,
                  },
                ]}
                disabled={!hasContent}
                activeOpacity={theme.state.pressedOpacity}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    { color: hasContent ? theme.text : theme.textSecondary },
                  ]}
                >
                  预览
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          <ScrollView
            style={styles.contentContainer}
            contentContainerStyle={styles.contentInner}
            scrollEnabled={!isDraggingMedia}
          >
            <View style={styles.tagContainer}>
              <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>标签</Text>
              <TagInput
                tags={tags}
                onTagsChange={setTags}
                content={content}
                suggestions={availableTags}
                placeholder="添加标签..."
                appearance="plain"
              />
            </View>

            <View style={styles.editorContainer}>
              <TextEditor
                value={content}
                onChange={setContent}
                placeholder={placeholder}
                appearance="plain"
              />
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
              <View
                style={[
                  styles.summaryContainer,
                  {
                    backgroundColor: theme.surfaceMuted,
                    borderRadius: theme.radius.medium,
                  },
                ]}
              >
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
              <View
                style={[
                  styles.errorContainer,
                  {
                    backgroundColor: theme.semantic.errorSoft,
                    borderRadius: theme.radius.medium,
                  },
                ]}
              >
                <Text style={[styles.errorText, { color: theme.error }]}>{summaryError}</Text>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextButton: {
    minWidth: 56,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextButtonLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  contentInner: {
    paddingBottom: 28,
  },
  tagContainer: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  editorContainer: {
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  imageContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  mediaHint: {
    fontSize: 12,
    marginBottom: 8,
  },
  summaryContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '500',
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
    marginBottom: 12,
    padding: 12,
  },
  errorText: {
    fontSize: 14,
  },
})
