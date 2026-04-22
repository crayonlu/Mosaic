import { DraggableImageGrid, Loading, toast } from '@/components/ui'
import type { MediaGridItem } from '@/components/ui/DraggableImageGrid'
import { useAIConfig } from '@/hooks/useAIConfig'
import {
  createSelectedMediaItems,
  uploadSelectedMedia,
  type SelectedMediaItem,
} from '@/lib/media/upload'
import { useBotThread, useReplyToBot } from '@/lib/query'
import { useThemeStore } from '@/stores/themeStore'
import type { BotReply } from '@mosaic/api'
import { ImagePlus, Send, X } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { KeyboardStickyView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface BotThreadSheetProps {
  visible: boolean
  reply: BotReply | null
  onClose: () => void
}

export function BotThreadSheet({ visible, reply, onClose }: BotThreadSheetProps) {
  const { theme } = useThemeStore()
  const insets = useSafeAreaInsets()
  const { config: aiConfig } = useAIConfig()
  const { data: thread, isLoading } = useBotThread(reply?.latestReplyId ?? reply?.id)
  const { mutateAsync: replyToBot, isPending } = useReplyToBot()
  const [text, setText] = useState('')
  const [mediaItems, setMediaItems] = useState<MediaGridItem[]>([])
  const [uploadCandidates, setUploadCandidates] = useState<Record<string, SelectedMediaItem>>({})
  const [uploadProgressItems, setUploadProgressItems] = useState<
    { id: string; progress: number }[]
  >([])

  useEffect(() => {
    if (!visible) {
      setText('')
      setMediaItems([])
      setUploadCandidates({})
      setUploadProgressItems([])
    }
  }, [visible])

  const bot = thread?.bot ?? reply?.bot
  const latestReplyId = thread?.latestReplyId ?? reply?.latestReplyId ?? reply?.id
  const uploadProgressById = useMemo(
    () => Object.fromEntries(uploadProgressItems.map(item => [item.id, item.progress])),
    [uploadProgressItems]
  )

  const handlePickImages = useCallback(async () => {
    if (!bot?.visionEnabled || !aiConfig?.supportsVision) {
      toast.error('该 Bot 未启用图片理解')
      return
    }

    const { launchImageLibraryAsync } = await import('expo-image-picker')
    const result = await launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    })

    if (result.canceled) return

    const slots = 4 - mediaItems.length
    if (slots <= 0) {
      toast.error('最多添加 4 张图片')
      return
    }

    const selected = (await createSelectedMediaItems(result.assets)).slice(0, slots)
    setUploadCandidates(prev => ({
      ...prev,
      ...Object.fromEntries(selected.map(item => [item.key, item])),
    }))
    setMediaItems(prev => [...prev, ...selected])
  }, [aiConfig?.supportsVision, bot?.visionEnabled, mediaItems.length])

  const handleSend = useCallback(async () => {
    const question = text.trim()
    if (!latestReplyId || (!question && mediaItems.length === 0) || isPending) return

    if (!aiConfig?.apiKey?.trim()) {
      toast.error('请先配置 AI')
      return
    }

    try {
      const pendingUploadItems = mediaItems
        .map(item => uploadCandidates[item.key])
        .filter((item): item is SelectedMediaItem => Boolean(item))
      const resourceIds: string[] = []

      if (pendingUploadItems.length > 0) {
        setUploadProgressItems(pendingUploadItems.map(item => ({ id: item.key, progress: 0 })))
        const uploaded = await uploadSelectedMedia(pendingUploadItems, {
          onFileProgress: (item, progress) => {
            setUploadProgressItems(prev =>
              prev.map(entry =>
                entry.id === item.key ? { ...entry, progress: progress.percent } : entry
              )
            )
          },
        })
        resourceIds.push(...uploaded.map(resource => resource.id))
      }

      await replyToBot({
        replyId: latestReplyId,
        data: {
          question: question || '请根据图片内容继续回复。',
          resourceIds,
        },
      })
      setText('')
      setMediaItems([])
      setUploadCandidates({})
      setUploadProgressItems([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '发送失败')
    }
  }, [aiConfig?.apiKey, isPending, latestReplyId, mediaItems, replyToBot, text, uploadCandidates])

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[styles.header, { borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>{bot?.name ?? 'Bot'}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              围绕这条 Memo 继续聊
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
        >
          {isLoading ? (
            <Loading text="加载中..." />
          ) : (
            thread?.messages.map((message, index) => {
              const isUser = message.role === 'user'
              return (
                <View
                  key={`${message.id}-${message.role}-${index}`}
                  style={[styles.messageRow, isUser && styles.userMessageRow]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      {
                        backgroundColor: isUser ? theme.primary : theme.surface,
                        borderRadius: theme.radius.medium,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.messageText, { color: isUser ? theme.onPrimary : theme.text }]}
                    >
                      {message.content}
                    </Text>
                  </View>
                </View>
              )
            })
          )}
        </ScrollView>

        <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
          <View
            style={[
              styles.replyBar,
              {
                borderTopColor: theme.border,
                backgroundColor: theme.surface,
                paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
              },
            ]}
          >
            <View style={styles.inputArea}>
              <View style={styles.inputRow}>
                {bot?.visionEnabled && aiConfig?.supportsVision && (
                  <TouchableOpacity
                    style={[styles.imageBtn, { backgroundColor: theme.surfaceMuted }]}
                    onPress={handlePickImages}
                    disabled={isPending}
                  >
                    <ImagePlus size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      borderColor: theme.border,
                      backgroundColor: theme.surfaceMuted,
                    },
                  ]}
                  value={text}
                  onChangeText={setText}
                  placeholder="继续追问..."
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  maxLength={500}
                />
              </View>
              {mediaItems.length > 0 && (
                <View style={styles.mediaGrid}>
                  <DraggableImageGrid
                    items={mediaItems}
                    uploadProgressById={uploadProgressById}
                    onItemsChange={setMediaItems}
                    draggable={false}
                  />
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[
                styles.sendBtn,
                {
                  backgroundColor:
                    text.trim() || mediaItems.length > 0 ? theme.primary : theme.surfaceMuted,
                },
              ]}
              onPress={handleSend}
              disabled={(!text.trim() && mediaItems.length === 0) || isPending}
            >
              <Send
                size={18}
                color={text.trim() || mediaItems.length > 0 ? theme.onPrimary : theme.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </KeyboardStickyView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  body: {
    flex: 1,
  },
  messages: {
    padding: 14,
    gap: 10,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '84%',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 21,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  inputArea: {
    flex: 1,
    gap: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  imageBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14,
    maxHeight: 100,
  },
  mediaGrid: {
    maxWidth: 220,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
