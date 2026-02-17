import { MarkdownRenderer } from '@/components/editor/MarkdownRenderer'
import { TextEditor } from '@/components/editor/TextEditor'
import { TagInput } from '@/components/tag/TagInput'
import { Button, DraggableImageGrid, Loading, toast } from '@/components/ui'
import { useConnection } from '@/hooks/use-connection'
import { useErrorHandler } from '@/hooks/use-error-handler'
import {
    useDeleteMemo,
    useMemo as useQueryMemo,
    useUpdateMemo,
} from '@/lib/query'
import { getBearerAuthHeaders } from '@/lib/services/api-auth'
import { stringUtils } from '@/lib/utils'
import { useThemeStore } from '@/stores/theme-store'
import { resourcesApi } from '@mosaic/api'
import { router, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, Image } from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export default function MemoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { theme } = useThemeStore()
  const { canUseNetwork } = useConnection()
  const handleError = useErrorHandler()
  const { data: memo, isLoading } = useQueryMemo(id || '')
  const { mutateAsync: updateMemo, isPending: isUpdating } = useUpdateMemo()
  const { mutateAsync: deleteMemo, isPending: isDeleting } = useDeleteMemo()

  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({})
  const [imageUris, setImageUris] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const isPending = isUpdating || isDeleting || uploading

  useEffect(() => {
    const loadAuthHeaders = async () => {
      const headers = await getBearerAuthHeaders()
      setAuthHeaders(headers)
    }
    loadAuthHeaders()
  }, [])

  useEffect(() => {
    if (editing && memo?.resources) {
      const existingImages = memo.resources
        .filter(r => r.resourceType === 'image')
        .map(r => resourcesApi.getDownloadUrl(r.id))
      setImageUris(existingImages)
    }
  }, [editing, memo])

  const handleImagesChange = useCallback((nextImageUris: string[]) => {
    setImageUris(nextImageUris)
  }, [imageUris])

  const selectImages = async () => {
    const { launchImageLibraryAsync } = await import('expo-image-picker')
    const result = await launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    })

    if (!result.canceled) {
      const newUris = result.assets.map(asset => asset.uri)
      setImageUris([...imageUris, ...newUris].slice(0, 9))
    }
  }

  const handleSave = useCallback(async () => {
    if (!memo || !canUseNetwork || isPending) return

    try {
      const existingImageResources = (memo.resources || []).filter(r => r.resourceType === 'image')
      const existingUriToId = new Map(
        existingImageResources.map(resource => [resourcesApi.getDownloadUrl(resource.id), resource.id]),
      )

      const newImageUris = imageUris.filter(uri => !existingUriToId.has(uri))
      const uploadedUriToId = new Map<string, string>()

      if (newImageUris.length > 0) {
        setUploading(true)
        for (const uri of newImageUris) {
          const resource = await resourcesApi.upload(
            {
              uri,
              name: `image_${Date.now()}.jpg`,
              type: 'image/jpeg',
            },
            memo.id,
          )
          uploadedUriToId.set(uri, resource.id)
        }
        setUploading(false)
      }

      const allResourceIds = imageUris
        .map(uri => existingUriToId.get(uri) || uploadedUriToId.get(uri))
        .filter((id): id is string => Boolean(id))

      await updateMemo({
        id: memo.id,
        data: { content: content.trim(), tags, resourceIds: allResourceIds },
      })
      setEditing(false)
      toast.success('成功', '已更新')
    } catch (error) {
      handleError(error)
      toast.error('错误', '更新失败')
    }
  }, [memo, content, tags, imageUris, canUseNetwork, isPending, updateMemo, handleError])
  const handleDelete = useCallback(() => {
    if (!memo) return

    toast.show({
      type: 'warning',
      title: '确认删除',
      message: '确定要删除这条Memo吗？此操作无法撤销。',
      actionLabel: '删除',
      onAction: async () => {
        try {
          await deleteMemo(memo.id)
          toast.success('成功', 'Memo已删除')
          router.back()
        } catch (error) {
          handleError(error)
          toast.error('错误', '删除失败')
        }
      },
    })
  }, [memo, deleteMemo, handleError])

  if (isLoading) {
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
          <Text style={[styles.emptyText, { color: theme.text }]}>Memo不存在</Text>
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
        <Text style={[styles.headerTitle, { color: theme.text }]}>Memo详情</Text>
        {!editing ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => {
                setEditing(true)
                setContent(memo.content)
                setTags(memo.tags || [])
              }}
              style={styles.headerButton}
            >
              <Text style={[styles.editButtonText, { color: theme.primary }]}>编辑</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              style={styles.headerButton}
            >
              <Text style={[styles.editButtonText, { color: theme.primary }]}>删除</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setEditing(false)} style={styles.headerButton}>
              <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={styles.headerButton} disabled={isPending}>
              <Text
                style={[
                  styles.cancelButtonText,
                  { color: isPending ? theme.textSecondary : theme.primary },
                ]}
              >
                保存
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.content}>
        {editing ? (
          <>
            <View style={{ minHeight: 150 }}>
              <TextEditor
                value={content}
                onChange={setContent}
                placeholder="What's on your mind?"
                editable={true}
              />
            </View>
            <View style={{ padding: 16, paddingBottom: 0 }}>
              <Text style={{ color: theme.textSecondary, marginBottom: 8 }}>标签</Text>
              <TagInput
                tags={tags}
                onTagsChange={setTags}
                content={content}
                placeholder="添加标签..."
              />
            </View>
            <View style={styles.imageUploadContainer}>
              <View style={styles.imageUploadHeader}>
                <Text style={{ color: theme.textSecondary }}>图片</Text>
                <Button
                  title="添加图片"
                  onPress={selectImages}
                  variant="ghost"
                  size="small"
                  leftIcon={<Image size={16} color={theme.text} />}
                  disabled={!canUseNetwork || imageUris.length >= 9}
                />
              </View>
              {imageUris.length > 0 && (
                <DraggableImageGrid
                  images={imageUris}
                  authHeaders={authHeaders}
                  onImagesChange={handleImagesChange}
                  maxImages={9}
                  onAddImage={selectImages}
                />
              )}
            </View>
          </>
        ) : (
          <>
            <View style={{ minHeight: 150, padding: 16 }}>
              <MarkdownRenderer content={memo.content} />
            </View>
            {memo.resources && memo.resources.length > 0 && (
              <View style={styles.resourcesContainer}>
                <DraggableImageGrid
                  images={memo.resources
                    .filter(r => r.resourceType === 'image')
                    .map(r => resourcesApi.getDownloadUrl(r.id))}
                  authHeaders={authHeaders}
                  draggable={false}
                />
              </View>
            )}
          </>
        )}

        {!editing && memo.tags && memo.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {memo.tags.map((tag, index) => (
              <View
                key={index}
                style={[styles.tag, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <Text style={[styles.tagText, { color: theme.textSecondary }]}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {!editing && (
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
        )}
      </View>
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
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 13,
  },
  resourcesContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metadata: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    marginTop: 16,
  },
  metadataText: {
    fontSize: 13,
    marginBottom: 4,
  },
  imageUploadContainer: {
    padding: 16,
    paddingTop: 8,
    minHeight: 100,
  },
  imageUploadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
})
