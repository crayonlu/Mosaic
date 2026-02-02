import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { TagInput } from '@/components/tag/TagInput'
import { Button, Loading, toast } from '@/components/ui'
import { diariesApi, memosApi } from '@/lib/api'
import { useConnection } from '@/hooks/use-connection'
import { useErrorHandler } from '@/hooks/use-error-handler'
import { stringUtils } from '@/lib/utils'
import { useThemeStore } from '@/stores/theme-store'
import { MOODS, type MoodKey } from '@/constants/common'
import { type MemoWithResources } from '@/types/memo'
import { router, useLocalSearchParams } from 'expo-router'
import { Archive, ArrowLeft, Trash2 } from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export default function MemoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { theme } = useThemeStore()
  const { canUseNetwork } = useConnection()
  const handleError = useErrorHandler()
  const [memo, setMemo] = useState<MemoWithResources | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [selectedMood, setSelectedMood] = useState<MoodKey | null>(null)
  const [archiving, setArchiving] = useState(false)

  const loadMemo = useCallback(async () => {
    if (!id || !canUseNetwork) return
    try {
      const data = await memosApi.get(id)
      if (data) {
        setMemo(data)
        setContent(data.content)
        setTags(data.tags || [])
      }
    } catch (error) {
      handleError(error)
      toast.error('错误', '加载备忘录失败')
      router.back()
    } finally {
      setLoading(false)
    }
  }, [id, canUseNetwork, handleError])

  useEffect(() => {
    if (id) loadMemo()
  }, [id, loadMemo])

  const handleSave = async () => {
    if (!memo) return

    try {
      const updated = await memosApi.update(memo.id, {
        content: content.trim(),
        tags,
      })
      if (updated) {
        setMemo(updated)
        setEditing(false)
        toast.success('成功', '备忘录已更新')
      }
    } catch (error) {
      handleError(error)
      toast.error('错误', '更新失败')
    }
  }

  const handleArchive = async () => {
    if (!memo) return

    try {
      if (memo.isArchived) {
        await memosApi.unarchive(memo.id)
      } else {
        setShowArchiveModal(true)
        return
      }
      const updated = await memosApi.get(memo.id)
      if (updated) {
        setMemo(updated)
        toast.success('成功', memo.isArchived ? '备忘录已取消归档' : '备忘录已归档')
      }
    } catch (error) {
      handleError(error)
      toast.error('错误', '操作失败')
    }
  }

  const handleArchiveToDiary = async () => {
    if (!memo || !selectedMood) return
    setArchiving(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      await diariesApi.createOrUpdate(today, {
        moodKey: selectedMood,
      })
      await memosApi.archive(memo.id)
      toast.success('成功', '已归档到今日日记')
      setShowArchiveModal(false)
      router.back()
    } catch (error) {
      handleError(error)
      toast.error('错误', '归档失败')
    } finally {
      setArchiving(false)
    }
  }

  const handleDelete = () => {
    if (!memo) return

    toast.show({
      type: 'warning',
      title: '确认删除',
      message: '确定要删除这条备忘录吗？此操作无法撤销。',
      actionLabel: '删除',
      onAction: async () => {
        try {
          await memosApi.delete(memo.id)
          toast.success('成功', '备忘录已删除')
          router.back()
        } catch (error) {
          handleError(error)
          toast.error('错误', '删除失败')
        }
      },
    })
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Loading text="加载中..." fullScreen />
      </View>
    )
  }

  if (!memo) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.text }]}>备忘录不存在</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={router.back} style={styles.headerButton}>
          <ArrowLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>备忘录详情</Text>
        {!editing ? (
          <TouchableOpacity onPress={() => setEditing(true)} style={styles.headerButton}>
            <Text style={[styles.editButtonText, { color: theme.primary }]}>编辑</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setEditing(false)} style={styles.headerButton}>
              <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
              <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>保存</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView style={styles.content}>
        {editing ? (
          <>
            <RichTextEditor
              content={content}
              onChange={setContent}
              editable={true}
              placeholder="编辑你的备忘录内容..."
              isExpanded={true}
              onSave={handleSave}
            />
            <View style={{ padding: 16 }}>
              <Text style={{ color: theme.textSecondary, marginBottom: 8 }}>标签</Text>
              <TagInput
                tags={tags}
                onTagsChange={setTags}
                content={content}
                placeholder="添加标签..."
              />
            </View>
          </>
        ) : (
          <RichTextEditor content={memo.content} editable={false} onChange={() => {}} />
        )}

        {memo.tags && memo.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {memo.tags.map((tag, index) => (
              <View
                key={index}
                style={[
                  styles.tag,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.tagText, { color: theme.textSecondary }]}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.metadata}>
          <Text style={[styles.metadataText, { color: theme.textSecondary }]}>
            创建于 {stringUtils.formatDateTime(memo.createdAt)}
          </Text>
          {memo.updatedAt > memo.createdAt && (
            <Text style={[styles.metadataText, { color: theme.textSecondary }]}>
              更新于 {stringUtils.formatDateTime(memo.updatedAt)}
            </Text>
          )}
        </View>
      </ScrollView>

      {!editing && (
        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <TouchableOpacity
            onPress={handleArchive}
            style={[styles.actionButton, { borderColor: theme.border }]}
            disabled={!canUseNetwork}
          >
            <Archive size={20} color={theme.text} />
            <Text style={[styles.actionButtonText, { color: theme.text }]}>
              {memo.isArchived ? '取消归档' : '归档'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
            <Trash2 size={20} color="#FFFFFF" />
            <Text style={styles.deleteButtonText}>删除</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={showArchiveModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>归档到日记</Text>
            <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>选择心情</Text>
            <View style={styles.moodSelector}>
              {MOODS.map(mood => (
                <TouchableOpacity
                  key={mood.value}
                  style={[
                    styles.moodOption,
                    selectedMood === mood.value && { backgroundColor: theme.primary + '20' },
                  ]}
                  onPress={() => setSelectedMood(mood.value)}
                >
                  <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                  <Text>{mood.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.surface }]}
                onPress={() => setShowArchiveModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={handleArchiveToDiary}
                disabled={!selectedMood || archiving}
              >
                {archiving ? (
                  <Loading size="small" />
                ) : (
                  <Text style={styles.modalButtonText}>确认归档</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  headerButton: {
    padding: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButtonText: {
    fontSize: 15,
  },
  content: {
    flex: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 13,
  },
  metadata: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    marginTop: 16,
  },
  metadataText: {
    fontSize: 13,
    marginBottom: 4,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#EF4444',
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    width: '100%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    marginBottom: 12,
  },
  moodSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    marginBottom: 20,
    gap: 'auto',
  },
  moodOption: {
    padding: 8,
    borderRadius: 8,
  },
  moodEmoji: {
    fontSize: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
})
