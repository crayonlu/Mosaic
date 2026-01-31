import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { Badge, Button } from '@/components/ui'
import { memosApi } from '@/lib/api'
import { stringUtils } from '@/lib/utils/string'
import { useThemeStore } from '@/stores/theme-store'
import type { MemoWithResources } from '@/types/memo'
import DateTimePicker from '@react-native-community/datetimepicker'
import { ArrowLeft, Check, Plus } from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Image,
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

interface MemoDetailProps {
  visible: boolean
  memo: MemoWithResources | null
  onMemoUpdate: (memo: MemoWithResources) => void
  onClose: () => void
  onDelete?: (id: string) => void
}

export function MemoDetail({ visible, memo, onMemoUpdate, onClose, onDelete }: MemoDetailProps) {
  const { theme } = useThemeStore()
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [diaryDate, setDiaryDate] = useState<Date | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Initialize form when memo changes
  useEffect(() => {
    if (memo) {
      setContent(memo.content)
      setTags(memo.tags)
      setDiaryDate(memo.diaryDate ? new Date(memo.diaryDate) : null)
      setHasChanges(false)
    }
  }, [memo])

  // Track changes
  useEffect(() => {
    if (memo) {
      const contentChanged = content !== memo.content
      const tagsChanged = JSON.stringify(tags) !== JSON.stringify(memo.tags)
      const dateChanged =
        (diaryDate?.toISOString().split('T')[0] || null) !== (memo.diaryDate || null)
      setHasChanges(contentChanged || tagsChanged || dateChanged)
    }
  }, [content, tags, diaryDate, memo])

  // Handle save
  const handleSave = useCallback(async () => {
    if (!memo) return

    try {
      const updatedMemo = await memosApi.update(memo.id, {
        content,
        tags,
        resourceFilenames: memo.resources.map(r => r.filename),
      })

      if (updatedMemo) {
        onMemoUpdate(updatedMemo)
        onClose()
      }
    } catch (error) {
      console.error('Failed to update memo:', error)
      Alert.alert('错误', '更新Memo失败')
    }
  }, [memo, content, tags, onMemoUpdate, onClose])

  // Handle archive
  const handleArchive = useCallback(async () => {
    if (!memo) return

    try {
      if (memo.isArchived) {
        await memosApi.unarchive(memo.id)
      } else {
        await memosApi.archive(memo.id)
      }
      const updatedMemo = await memosApi.get(memo.id)
      if (updatedMemo) {
        onMemoUpdate(updatedMemo)
      }
      onClose()
    } catch (error) {
      console.error('Failed to archive memo:', error)
      Alert.alert('错误', memo.isArchived ? '取消归档失败' : '归档失败')
    }
  }, [memo, onMemoUpdate, onClose])

  // Handle delete
  const handleDelete = useCallback(() => {
    if (!memo) return

    Alert.alert('删除Memo', '确定要删除这条Memo吗？删除后可以在归档中恢复。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await memosApi.delete(memo.id)
            onDelete?.(memo.id)
            onClose()
          } catch (error) {
            console.error('Failed to delete memo:', error)
            Alert.alert('错误', '删除失败')
          }
        },
      },
    ])
  }, [memo, onDelete, onClose])

  // Handle add tag
  const handleAddTag = useCallback(() => {
    const trimmedTag = tagInput.trim()
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag])
      setTagInput('')
    }
  }, [tagInput, tags])

  // Handle remove tag
  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      setTags(tags.filter(tag => tag !== tagToRemove))
    },
    [tags]
  )

  // Handle date change
  const handleDateChange = useCallback((event: any, selectedDate?: Date) => {
    setShowDatePicker(false)
    if (selectedDate) {
      setDiaryDate(selectedDate)
    }
  }, [])

  // Handle close with unsaved changes confirmation
  const handleClose = useCallback(() => {
    if (hasChanges) {
      Alert.alert('未保存的更改', '您有未保存的更改，确定要关闭吗？', [
        { text: '继续编辑', style: 'cancel' },
        {
          text: '放弃更改',
          style: 'destructive',
          onPress: onClose,
        },
      ])
    } else {
      onClose()
    }
  }, [hasChanges, onClose])

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
          {/* Header */}
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
              style={[styles.headerButton, !hasChanges && styles.headerButtonDisabled]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={!hasChanges}
            >
              <Check
                size={24}
                color={hasChanges ? theme.primary : theme.textSecondary}
                strokeWidth={2}
              />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView}>
            {/* Tags */}
            <View style={styles.tagsSection}>
              <View style={styles.tagsRow}>
                {tags.map(tag => (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => handleRemoveTag(tag)}
                    style={styles.tagContainer}
                  >
                    <Badge text={tag} variant="solid" />
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.tagInputRow}>
                <TextInput
                  style={[styles.tagInput, { color: theme.text, borderColor: theme.border }]}
                  value={tagInput}
                  onChangeText={setTagInput}
                  placeholder="添加标签..."
                  placeholderTextColor={theme.textSecondary}
                  onSubmitEditing={handleAddTag}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  onPress={handleAddTag}
                  style={[styles.addTagButton, { backgroundColor: theme.primary }]}
                  disabled={!tagInput.trim()}
                >
                  <Plus size={18} color="#fff" strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Diary Date */}
            {diaryDate && (
              <View style={styles.dateSection}>
                <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>
                  📅 日记日期: {stringUtils.formatDate(diaryDate.toISOString().split('T')[0] || '')}
                </Text>
              </View>
            )}

            {/* Content */}
            <View style={styles.contentSection}>
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="编辑内容..."
                editable={true}
                isExpanded={true}
              />
            </View>

            {/* Resources */}
            {memo.resources.length > 0 && (
              <View style={styles.resourcesSection}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  附件 ({memo.resources.length})
                </Text>

                {/* Images */}
                {imageResources.length > 0 && (
                  <View style={styles.imagesGrid}>
                    {imageResources.map(resource => (
                      <Image
                        key={resource.id}
                        source={{ uri: `file://${resource.filename}` }}
                        style={styles.resourceImage}
                        resizeMode="cover"
                      />
                    ))}
                  </View>
                )}

                {/* Other resources */}
                {otherResources.length > 0 && (
                  <View style={styles.otherResources}>
                    {otherResources.map(resource => (
                      <View
                        key={resource.id}
                        style={[
                          styles.otherResourceItem,
                          { backgroundColor: theme.card, borderColor: theme.border },
                        ]}
                      >
                        <Text style={[styles.otherResourceName, { color: theme.text }]}>
                          📎 {resource.filename}
                        </Text>
                        <Text style={[styles.otherResourceSize, { color: theme.textSecondary }]}>
                          {stringUtils.formatFileSize(resource.fileSize)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Timestamp */}
            <View style={styles.timestampSection}>
              <Text style={[styles.timestampText, { color: theme.textSecondary }]}>
                创建于 {stringUtils.formatDateTime(memo.createdAt)}
              </Text>
              {memo.updatedAt > memo.createdAt && (
                <Text style={[styles.timestampText, { color: theme.textSecondary }]}>
                  更新于 {stringUtils.formatDateTime(memo.updatedAt)}
                </Text>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Footer actions */}
        <View
          style={[
            styles.footer,
            { borderTopColor: theme.border, backgroundColor: theme.background },
          ]}
        >
          <Button
            title={memo.isArchived ? '取消归档' : '归档'}
            onPress={handleArchive}
            variant="secondary"
            size="medium"
            style={styles.footerButton}
          />
          <Button
            title="删除"
            onPress={handleDelete}
            variant="danger"
            size="medium"
            style={styles.footerButton}
          />
        </View>

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={diaryDate || new Date()}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}
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
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonDisabled: {
    opacity: 0.3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  tagsSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tagContainer: {
    marginRight: -8,
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  addTagButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  dateLabel: {
    fontSize: 12,
  },
  contentSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  resourcesSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  resourceImage: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 8,
  },
  otherResources: {
    marginTop: 12,
  },
  otherResourceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  otherResourceName: {
    fontSize: 14,
    flex: 1,
  },
  otherResourceSize: {
    fontSize: 12,
    marginLeft: 8,
  },
  timestampSection: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  timestampText: {
    fontSize: 12,
    opacity: 0.7,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  footerButton: {
    flex: 1,
  },
})
