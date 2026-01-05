import { Loading } from '@/components/ui/Loading'
import { toast } from '@/components/ui/Toast'
import { memoService } from '@/lib/services/memo-service'
import { useThemeStore } from '@/stores/theme-store'
import { type MemoWithResources } from '@/types/memo'
import { router, useLocalSearchParams } from 'expo-router'
import { Archive, ArrowLeft, Save, Trash2 } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

export default function MemoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { theme } = useThemeStore()
  const [memo, setMemo] = useState<MemoWithResources | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState('')

  useEffect(() => {
    if (id) {
      loadMemo()
    }
  }, [id])

  const loadMemo = async () => {
    try {
      const data = await memoService.getMemo(id)
      if (data) {
        setMemo(data)
        setContent(data.content)
      }
    } catch (error) {
      toast.error('错误', '加载备忘录失败')
      console.error('Load memo error:', error)
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!memo) return

    try {
      const updated = await memoService.updateMemo({
        id: memo.id,
        content: content.trim(),
        tags: memo.tags,
        resourceFilenames: memo.resources.map(r => r.filename),
      })
      if (updated) {
        setMemo(updated)
        setEditing(false)
        toast.success('成功', '备忘录已更新')
      }
    } catch (error) {
      toast.error('错误', '更新失败')
      console.error('Update memo error:', error)
    }
  }

  const handleArchive = async () => {
    if (!memo) return

    try {
      await memoService.archiveMemo(memo.id, !memo.isArchived)
      const updated = await memoService.getMemo(memo.id)
      if (updated) {
        setMemo(updated)
        toast.success(
          '成功',
          memo.isArchived ? '备忘录已取消归档' : '备忘录已归档'
        )
      }
    } catch (error) {
      toast.error('错误', '操作失败')
      console.error('Archive error:', error)
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
          await memoService.deleteMemo(memo.id)
          toast.success('成功', '备忘录已删除')
          router.back()
        } catch (error) {
          toast.error('错误', '删除失败')
          console.error('Delete error:', error)
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
      {/* Header */}
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
              <Save size={20} color={theme.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {editing ? (
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            value={content}
            onChangeText={setContent}
            multiline
            autoFocus
            placeholder="输入备忘录内容..."
            placeholderTextColor={theme.textSecondary}
          />
        ) : (
          <Text style={[styles.content, { color: theme.text }]}>
            {memo.content || '无内容'}
          </Text>
        )}

        {/* Tags */}
        {memo.tags && memo.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {memo.tags.map((tag, index) => (
              <View
                key={index}
                style={[
                  styles.tag,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={[styles.tagText, { color: theme.textSecondary }]}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Metadata */}
        <View style={styles.metadata}>
          <Text style={[styles.metadataText, { color: theme.textSecondary }]}>
            创建于 {new Date(memo.createdAt).toLocaleString('zh-CN')}
          </Text>
          {memo.updatedAt > memo.createdAt && (
            <Text style={[styles.metadataText, { color: theme.textSecondary }]}>
              更新于 {new Date(memo.updatedAt).toLocaleString('zh-CN')}
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Footer Actions */}
      {!editing && (
        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <TouchableOpacity
            onPress={handleArchive}
            style={[styles.actionButton, { borderColor: theme.border }]}
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
    borderBottomWidth: 1,
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
    padding: 16,
    lineHeight: 24,
    fontSize: 16,
  },
  input: {
    margin: 16,
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 200,
    lineHeight: 24,
    fontSize: 16,
    textAlignVertical: 'top',
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
})
