import { toast } from '@/components/ui'
import { useCreateMemo } from '@/lib/query/mutations/memoMutations'
import { useThemeStore } from '@/stores/themeStore'
import { apiClient, resourcesApi } from '@mosaic/api'
import { useShareIntentContext } from 'expo-share-intent'
import { router } from 'expo-router'
import { X } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'

interface ClipResult {
  title: string
  content: string
  aiSummary: string
  tags: string[]
  sourceUrl: string | null
  sourceType: string
  originalTitle: string | null
}

type ClipState = 'loading' | 'ready' | 'error'

export default function ShareScreen() {
  const { theme } = useThemeStore()
  const { shareIntent, resetShareIntent, hasShareIntent } = useShareIntentContext()
  const { mutateAsync: createMemo } = useCreateMemo()

  const [clipState, setClipState] = useState<ClipState>('loading')
  const [clipResult, setClipResult] = useState<ClipResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [title, setTitle] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [userNote, setUserNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [attachedResourceId, setAttachedResourceId] = useState<string | null>(null)
  const hasProcessed = useRef(false)

  const processShareIntent = useCallback(async () => {
    if (!hasShareIntent || hasProcessed.current) return
    hasProcessed.current = true

    try {
      let clipType: 'url' | 'text' | 'image' = 'text'
      let body: Record<string, string> = {}

      if (shareIntent.type === 'weburl' && shareIntent.webUrl) {
        clipType = 'url'
        body = { clipType, url: shareIntent.webUrl }
      } else if (shareIntent.type === 'text' && shareIntent.text) {
        clipType = 'text'
        body = { clipType, content: shareIntent.text }
      } else if (shareIntent.files?.length && shareIntent.files[0]) {
        clipType = 'image'
        const file = shareIntent.files[0]
        const uploaded = await resourcesApi.upload({
          uri: file.path,
          name: file.fileName || 'image.jpg',
          type: file.mimeType || 'image/jpeg',
        })
        setAttachedResourceId(uploaded.id)
        body = { clipType, resourceId: uploaded.id }
      } else {
        setClipState('error')
        setErrorMessage('无法识别分享的内容')
        return
      }

      const result = await apiClient.post<ClipResult>('/api/memos/clip', body, 120_000)
      setClipResult(result)
      setTitle(result.title)
      setSelectedTags(result.tags)
      setClipState('ready')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI 处理失败，请重试'
      setClipState('error')
      setErrorMessage(msg)
    }
  }, [hasShareIntent, shareIntent])

  useEffect(() => {
    processShareIntent()
  }, [processShareIntent])

  const handleToggleTag = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }, [])

  const handleSave = useCallback(async () => {
    if (!clipResult || isSaving) return
    setIsSaving(true)

    try {
      const content = userNote.trim()
        ? `${clipResult.content}\n\n---\n我的想法：${userNote}`
        : clipResult.content

      const resourceIds = attachedResourceId ? [attachedResourceId] : []

      await createMemo({
        content,
        tags: selectedTags,
        resourceIds,
        aiSummary: clipResult.aiSummary,
      })

      toast.success('已保存', 'Memo 已保存到 Mosaic')
      resetShareIntent()
      router.back()
    } catch {
      toast.error('保存失败', '请重试')
    } finally {
      setIsSaving(false)
    }
  }, [clipResult, isSaving, userNote, selectedTags, attachedResourceId, createMemo, resetShareIntent])

  const handleCancel = useCallback(() => {
    resetShareIntent()
    router.back()
  }, [resetShareIntent])

  const sourceLabel = clipResult?.sourceUrl
    ? new URL(clipResult.sourceUrl).hostname
    : clipResult?.sourceType === 'image'
      ? '图片'
      : '文本'

  const canSave = clipState === 'ready' && !isSaving

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={styles.header}>
          <Pressable onPress={handleCancel} hitSlop={12} style={styles.headerBtn}>
            <X size={20} color={theme.textTertiary} strokeWidth={1.5} />
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={styles.headerBtn}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Text
                style={[
                  styles.saveText,
                  { color: theme.primary, opacity: canSave ? 1 : 0.3 },
                ]}
              >
                保存
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {clipState === 'loading' && (
            <View style={styles.contentFlow}>
              <View style={[styles.skeletonLine, styles.skeletonShort, { backgroundColor: theme.surfaceMuted }]} />
              <View style={[styles.skeletonLine, styles.skeletonTitle, { backgroundColor: theme.surfaceMuted }]} />
              <View style={[styles.skeletonLine, { backgroundColor: theme.surfaceMuted }]} />
              <View style={[styles.skeletonLine, { backgroundColor: theme.surfaceMuted }]} />
              <View style={[styles.skeletonLine, styles.skeletonMedium, { backgroundColor: theme.surfaceMuted }]} />
              <View style={[styles.skeletonLine, styles.skeletonShort, { backgroundColor: theme.surfaceMuted }]} />
              <View style={[styles.skeletonLine, { backgroundColor: theme.surfaceMuted }]} />
              <View style={[styles.skeletonLine, styles.skeletonMedium, { backgroundColor: theme.surfaceMuted }]} />
              <View style={styles.skeletonGap} />
              <View style={[styles.skeletonLine, styles.skeletonShort, { backgroundColor: theme.surfaceMuted }]} />
              <View style={[styles.skeletonLine, { backgroundColor: theme.surfaceMuted }]} />
              <View style={[styles.skeletonLine, styles.skeletonMedium, { backgroundColor: theme.surfaceMuted }]} />
              <View style={styles.skeletonGap} />
              <View style={styles.skeletonTagsRow}>
                <View style={[styles.skeletonTag, { backgroundColor: theme.surfaceMuted }]} />
                <View style={[styles.skeletonTag, { backgroundColor: theme.surfaceMuted }]} />
                <View style={[styles.skeletonTag, styles.skeletonTagWide, { backgroundColor: theme.surfaceMuted }]} />
              </View>
            </View>
          )}

          {clipState === 'error' && (
            <View style={styles.centerContent}>
              <Text style={[styles.errorText, { color: theme.error }]}>
                {errorMessage}
              </Text>
              <Pressable onPress={handleCancel}>
                <Text style={[styles.retryText, { color: theme.textSecondary }]}>
                  返回
                </Text>
              </Pressable>
            </View>
          )}

          {clipState === 'ready' && clipResult && (
            <View style={styles.contentFlow}>
              <Text style={[styles.source, { color: theme.textTertiary }]}>
                {sourceLabel}
              </Text>

              <TextInput
                style={[styles.title, { color: theme.text }]}
                value={title}
                onChangeText={setTitle}
                placeholder="标题"
                placeholderTextColor={theme.textTertiary}
                multiline
              />

              <Text style={[styles.body_, { color: theme.text }]}>
                {clipResult.content}
              </Text>

              <Text style={[styles.summary, { color: theme.textSecondary }]}>
                {clipResult.aiSummary}
              </Text>

              <View style={styles.tagsRow}>
                {selectedTags.map(tag => (
                  <Pressable
                    key={tag}
                    onPress={() => handleToggleTag(tag)}
                    style={[styles.tag, { backgroundColor: theme.primary }]}
                  >
                    <Text style={[styles.tagText, { color: theme.onPrimary }]}>
                      {tag}
                    </Text>
                  </Pressable>
                ))}
                {clipResult.tags
                  .filter(t => !selectedTags.includes(t))
                  .map(tag => (
                    <Pressable
                      key={tag}
                      onPress={() => handleToggleTag(tag)}
                      style={[styles.tag, { backgroundColor: theme.surfaceMuted }]}
                    >
                      <Text style={[styles.tagText, { color: theme.textSecondary }]}>
                        {tag}
                      </Text>
                    </Pressable>
                  ))}
              </View>

              <TextInput
                style={[styles.note, { color: theme.text }]}
                value={userNote}
                onChangeText={setUserNote}
                placeholder="写下你的想法..."
                placeholderTextColor={theme.textTertiary}
                multiline
                textAlignVertical="top"
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerBtn: {
    padding: 4,
  },
  saveText: {
    fontSize: 15,
    fontWeight: '500',
  },
  body: { flex: 1 },
  bodyContent: {
    paddingHorizontal: 24,
    paddingBottom: 60,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 160,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryText: {
    fontSize: 14,
    marginTop: 4,
  },
  contentFlow: {
    gap: 0,
  },
  source: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.3,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 30,
    padding: 0,
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  body_: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 28,
    letterSpacing: 0.1,
  },
  summary: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 28,
    fontStyle: 'italic',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 32,
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '400',
  },
  note: {
    fontSize: 15,
    lineHeight: 24,
    minHeight: 80,
    padding: 0,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 7,
    marginBottom: 10,
  },
  skeletonShort: {
    width: '40%',
  },
  skeletonMedium: {
    width: '70%',
  },
  skeletonTitle: {
    height: 22,
    borderRadius: 4,
    width: '80%',
    marginBottom: 20,
  },
  skeletonGap: {
    height: 16,
  },
  skeletonTagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  skeletonTag: {
    height: 28,
    width: 60,
    borderRadius: 100,
  },
  skeletonTagWide: {
    width: 80,
  },
})
