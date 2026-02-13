import { Badge, DraggableImageGrid } from '@/components/ui'
import { useToastConfirm } from '@/hooks/useToastConfirm'
import { resourcesApi } from '@/lib/api/resources'
import { useArchiveMemo, useDeleteMemo, useUpdateMemo } from '@/lib/query'
import { useThemeStore } from '@/stores/theme-store'
import type { MemoWithResources } from '@/types/memo'
import DateTimePicker from '@react-native-community/datetimepicker'
import { ArrowLeft, Check } from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TextEditor } from '../editor/TextEditor'
interface MemoDetailProps {
  visible: boolean
  memo: MemoWithResources | null
  onClose: () => void
  onDelete?: (id: string) => void
}

export function MemoDetail({ visible, memo, onClose, onDelete }: MemoDetailProps) {
  const { theme } = useThemeStore()
  const { mutateAsync: updateMemo, isPending: isUpdating } = useUpdateMemo()
  const { mutateAsync: archiveMemo, isPending: isArchiving } = useArchiveMemo()
  const { mutateAsync: deleteMemo, isPending: isDeleting } = useDeleteMemo()

  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [diaryDate, setDiaryDate] = useState<Date | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({})

  const { confirm } = useToastConfirm()

  const isPending = isUpdating || isArchiving || isDeleting

  useEffect(() => {
    if (memo) {
      setContent(memo.content)
      setTags(memo.tags)
      setDiaryDate(memo.diaryDate ? new Date(memo.diaryDate) : null)
      setHasChanges(false)
    }
  }, [memo])

  useEffect(() => {
    const loadAuthHeaders = async () => {
      const headers = await resourcesApi.getAuthHeaders()
      setAuthHeaders(headers)
    }
    loadAuthHeaders()
  }, [])

  useEffect(() => {
    if (memo) {
      const contentChanged = content !== memo.content
      const tagsChanged = JSON.stringify(tags) !== JSON.stringify(memo.tags)
      const dateChanged =
        (diaryDate?.toISOString().split('T')[0] || null) !== (memo.diaryDate || null)
      setHasChanges(contentChanged || tagsChanged || dateChanged)
    }
  }, [content, tags, diaryDate, memo])

  const handleSave = useCallback(async () => {
    if (!memo || !hasChanges || isPending) return

    try {
      await updateMemo({
        id: memo.id,
        data: {
          content,
          tags,
          resourceIds: memo.resources.map(r => r.id),
        },
      })
      onClose()
    } catch (error) {
      console.error('Failed to update memo:', error)
    }
  }, [memo, content, tags, hasChanges, isPending, updateMemo, onClose])

  const handleArchive = useCallback(async () => {
    if (!memo || isPending) return

    try {
      if (memo.isArchived) {
        await archiveMemo(memo.id)
      } else {
        await archiveMemo(memo.id)
      }
      onClose()
    } catch (error) {
      console.error('Failed to archive memo:', error)
    }
  }, [memo, isPending, archiveMemo, onClose])

  const handleDelete = useCallback(() => {
    if (!memo) return

    confirm('确定删除这条 Memo 吗？', async () => {
      await deleteMemo(memo.id)
      onDelete?.(memo.id)
      onClose()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memo, isPending, deleteMemo, onDelete, onClose, confirm])

  const handleAddTag = useCallback(() => {
    const trimmedTag = tagInput.trim()
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag])
      setTagInput('')
    }
  }, [tagInput, tags])

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      confirm(`确定删除标签 "${tagToRemove}" 吗？`, () => {
        setTags(tags.filter(tag => tag !== tagToRemove))
      })
    },
    [tags, confirm]
  )

  const handleDateChange = useCallback((event: any, selectedDate?: Date) => {
    setShowDatePicker(false)
    if (selectedDate) {
      setDiaryDate(selectedDate)
    }
  }, [])

  const handleClose = useCallback(() => {
    if (hasChanges) {
      confirm('您有未保存的更改，确定要关闭吗？', () => {
        onClose()
      })
    } else {
      onClose()
    }
  }, [hasChanges, onClose, confirm])

  if (!memo) {
    return null
  }

  const imageResources = memo.resources.filter(r => r.resourceType === 'image')
  const otherResources = memo.resources.filter(r => r.resourceType !== 'image')

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top', 'left', 'right']}
      >
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.headerButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={24} color={theme.text} strokeWidth={2} />
            </TouchableOpacity>

            <Text style={[styles.headerTitle, { color: theme.text }]}>
              {hasChanges ? '编辑Memo (未保存)' : 'Memo 详情'}
            </Text>

            <TouchableOpacity
              onPress={handleSave}
              style={[
                styles.headerButton,
                (!hasChanges || isPending) && styles.headerButtonDisabled,
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={!hasChanges || isPending}
            >
              <Check size={24} color={theme.primary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.content}>
              <TextEditor
                value={content}
                onChange={setContent}
                placeholder="What's on your mind?"
                editable={!isPending}
              />
            </View>

            <View style={[styles.section, { marginTop: 16 }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>标签</Text>
              <View style={styles.tagContainer}>
                {tags.map(tag => (
                  <Badge
                    key={tag}
                    text={tag}
                    variant="outline"
                    size="small"
                    onPress={() => handleRemoveTag(tag)}
                  />
                ))}
              </View>
              <View style={styles.addTagContainer}>
                <TextInput
                  style={[styles.addTagInput, { color: theme.text, borderColor: theme.border }]}
                  value={tagInput}
                  onChangeText={setTagInput}
                  placeholder="添加标签..."
                  placeholderTextColor={theme.textSecondary}
                  onSubmitEditing={handleAddTag}
                  returnKeyType="done"
                />
              </View>
            </View>

            <View style={[styles.section, { marginTop: 16 }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>日期</Text>
              <TouchableOpacity
                style={[styles.datePicker, { borderColor: theme.border }]}
                onPress={() => setShowDatePicker(true)}
                disabled={isPending}
              >
                <Text style={[styles.dateText, { color: theme.text }]}>
                  {diaryDate
                    ? diaryDate.toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : '未设置'}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={diaryDate || new Date()}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                />
              )}
            </View>

            {imageResources.length > 0 && (
              <View style={[styles.section, { marginTop: 16 }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>图片</Text>
                <DraggableImageGrid
                  images={imageResources.map(r => resourcesApi.getDirectDownloadUrl(r.id))}
                  authHeaders={authHeaders}
                  draggable={false}
                />
              </View>
            )}

            {otherResources.length > 0 && (
              <View style={[styles.section, { marginTop: 16 }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>附件</Text>
                <View style={styles.resourceList}>
                  {otherResources.map(resource => (
                    <TouchableOpacity
                      key={resource.id}
                      style={[styles.resourceItem, { borderColor: theme.border }]}
                    >
                      <Text style={[styles.resourceName, { color: theme.text }]}>
                        {resource.filename}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.footerButton, styles.footerButtonDanger]}
              onPress={memo.isArchived ? handleDelete : handleArchive}
              disabled={isPending}
            >
              <Text style={[styles.footerButtonText, { color: '#EF4444' }]}>
                {memo.isArchived ? '删除' : '归档'}
              </Text>
            </TouchableOpacity>
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
    padding: 16,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: 8,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tagText: {
    fontSize: 13,
  },
  removeTagButton: {
    padding: 2,
  },
  addTagContainer: {
    marginTop: 8,
  },
  addTagInput: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
  },
  datePicker: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  dateText: {
    fontSize: 14,
  },
  imageGallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  resourceList: {
    marginTop: 8,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
  },
  resourceName: {
    fontSize: 14,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
  },
  footerButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  footerButtonDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  footerButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
})
