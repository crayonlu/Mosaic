import { toast } from '@/components/ui'
import type { MediaGridItem } from '@/components/ui/DraggableImageGrid'
import { useAIConfig } from '@/hooks/useAIConfig'
import {
  createSelectedMediaItems,
  uploadSelectedMedia,
  type SelectedMediaItem,
} from '@/lib/media/upload'
import { useBotThread, useReplyToBot } from '@/lib/query'
import { getBearerAuthHeaders } from '@/lib/services/apiAuth'
import { useThemeStore } from '@/stores/themeStore'
import { resourcesApi, type BotReply } from '@mosaic/api'
import { Image } from 'expo-image'
import { ChevronDown, ChevronUp, ImagePlus, Lightbulb, Send, X } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface PendingMessage {
  id: string
  role: 'user'
  content: string
  previewUris?: string[]
}

function ThinkingContentBlock({ content, theme }: { content: string; theme: any }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <View style={[styles.thinkingContainer, { backgroundColor: theme.surfaceMuted }]}>
      <TouchableOpacity
        onPress={() => setExpanded(v => !v)}
        style={styles.thinkingHeader}
        activeOpacity={0.7}
        accessibilityLabel="展开/折叠心路历程"
      >
        <Lightbulb size={14} color={theme.textSecondary} />
        <Text style={[styles.thinkingTitle, { color: theme.textSecondary }]}>心路历程</Text>
        {expanded ? (
          <ChevronUp size={14} color={theme.textSecondary} style={{ marginLeft: 'auto' }} />
        ) : (
          <ChevronDown size={14} color={theme.textSecondary} style={{ marginLeft: 'auto' }} />
        )}
      </TouchableOpacity>
      {expanded && (
        <View>
          <Text style={[styles.thinkingContent, { color: theme.textSecondary }]}>{content}</Text>
        </View>
      )}
    </View>
  )
}

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
  const scrollViewRef = useRef<ScrollView>(null)
  const [text, setText] = useState('')
  const [mediaItems, setMediaItems] = useState<MediaGridItem[]>([])
  const [uploadCandidates, setUploadCandidates] = useState<Record<string, SelectedMediaItem>>({})
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({})
  const [uploadProgressItems, setUploadProgressItems] = useState<
    { id: string; progress: number }[]
  >([])
  const [pendingMessage, setPendingMessage] = useState<PendingMessage | null>(null)
  const [replyBarHeight, setReplyBarHeight] = useState(0)

  useEffect(() => {
    if (!visible) {
      setText('')
      setMediaItems([])
      setUploadCandidates({})
      setUploadProgressItems([])
      setPendingMessage(null)
    }
  }, [visible])

  useEffect(() => {
    if (!visible) return
    void getBearerAuthHeaders().then(setAuthHeaders)
  }, [visible])

  const bot = thread?.bot ?? reply?.bot
  const latestReplyId = thread?.latestReplyId ?? reply?.latestReplyId ?? reply?.id
  const messages = pendingMessage
    ? [...(thread?.messages ?? []), pendingMessage]
    : (thread?.messages ?? [])
  const uploadProgressById = useMemo(
    () => Object.fromEntries(uploadProgressItems.map(item => [item.id, item.progress])),
    [uploadProgressItems]
  )
  const messagesBottomInset = replyBarHeight + 12

  const scrollToLatest = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated })
    })
  }, [])

  useEffect(() => {
    if (!visible) return
    scrollToLatest(false)
  }, [messages.length, scrollToLatest, visible])

  const handlePickImages = useCallback(async () => {
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
  }, [mediaItems.length])

  const handleSend = useCallback(async () => {
    const question = text.trim()
    if (!latestReplyId || (!question && mediaItems.length === 0) || isPending) return

    if (!aiConfig?.apiKey?.trim()) {
      toast.error('请先配置 AI')
      return
    }

    const sentText = question || '请根据图片内容继续回复。'
    const sentMediaItems = mediaItems
    const sentUploadCandidates = uploadCandidates

    setText('')
    setMediaItems([])
    setUploadCandidates({})
    setPendingMessage({
      id: `pending-${Date.now()}`,
      role: 'user',
      content: sentText,
      previewUris: sentMediaItems.map(item => item.uri),
    })

    try {
      const pendingUploadItems = sentMediaItems
        .map(item => sentUploadCandidates[item.key])
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
          question: sentText,
          resourceIds,
        },
      })
      setUploadProgressItems([])
      setPendingMessage(null)
    } catch (error) {
      setText(question)
      setMediaItems(sentMediaItems)
      setUploadCandidates(sentUploadCandidates)
      setPendingMessage(null)
      toast.error(error instanceof Error ? error.message : '发送失败')
    }
  }, [aiConfig?.apiKey, isPending, latestReplyId, mediaItems, replyToBot, text, uploadCandidates])

  const removeMediaItem = useCallback((key: string) => {
    setMediaItems(prev => prev.filter(item => item.key !== key))
    setUploadCandidates(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <KeyboardAvoidingView style={styles.content} behavior="padding">
          <View
            style={[
              styles.header,
              { borderBottomColor: theme.border, paddingTop: insets.top + 12 },
            ]}
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
            ref={scrollViewRef}
            style={styles.body}
            contentContainerStyle={[styles.messages, { paddingBottom: messagesBottomInset }]}
            keyboardShouldPersistTaps="handled"
          >
            {isLoading ? (
              <View style={styles.skeletonContainer}>
                <View style={[styles.messageRow, styles.userMessageRow]}>
                  <View
                    style={[
                      styles.skeletonBubble,
                      styles.skeletonShort,
                      { backgroundColor: theme.surfaceMuted, borderRadius: theme.radius.medium },
                    ]}
                  />
                </View>
                <View style={styles.messageRow}>
                  <View
                    style={[
                      styles.skeletonBubble,
                      styles.skeletonTall,
                      { backgroundColor: theme.surfaceMuted, borderRadius: theme.radius.medium },
                    ]}
                  />
                </View>
                <View style={[styles.messageRow, styles.userMessageRow]}>
                  <View
                    style={[
                      styles.skeletonBubble,
                      styles.skeletonMedium,
                      { backgroundColor: theme.surfaceMuted, borderRadius: theme.radius.medium },
                    ]}
                  />
                </View>
              </View>
            ) : (
              <>
                {messages.map((message, index) => {
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
                          style={[
                            styles.messageText,
                            { color: isUser ? theme.onPrimary : theme.text },
                          ]}
                        >
                          {message.content}
                        </Text>
                        {!isUser && 'thinkingContent' in message && message.thinkingContent && (
                          <ThinkingContentBlock content={message.thinkingContent} theme={theme} />
                        )}
                        {'resourceIds' in message && message.resourceIds.length > 0 && (
                          <View style={styles.messageImages}>
                            {message.resourceIds.map(resourceId => (
                              <Image
                                key={resourceId}
                                source={{
                                  uri: resourcesApi.getDownloadUrl(resourceId, 'thumb'),
                                  headers: authHeaders,
                                }}
                                style={styles.messageImage}
                                contentFit="cover"
                              />
                            ))}
                          </View>
                        )}
                        {'previewUris' in message &&
                          message.previewUris &&
                          message.previewUris.length > 0 && (
                            <View style={styles.messageImages}>
                              {message.previewUris.map(uri => (
                                <Image
                                  key={uri}
                                  source={{ uri }}
                                  style={styles.messageImage}
                                  contentFit="cover"
                                />
                              ))}
                            </View>
                          )}
                      </View>
                    </View>
                  )
                })}
                {isPending && (
                  <View style={styles.messageRow}>
                    <View
                      style={[
                        styles.messageBubble,
                        {
                          backgroundColor: theme.surface,
                          borderRadius: theme.radius.medium,
                        },
                      ]}
                    >
                      <Text style={[styles.messageText, { color: theme.textSecondary }]}>
                        正在回复...
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
          <View
            style={[
              styles.replyBar,
              {
                borderTopColor: theme.border,
                backgroundColor: theme.surface,
                paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
              },
            ]}
            onLayout={event => {
              setReplyBarHeight(event.nativeEvent.layout.height)
            }}
          >
            <View style={styles.inputArea}>
              {mediaItems.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.mediaStrip}
                  keyboardShouldPersistTaps="handled"
                >
                  {mediaItems.map(item => (
                    <View key={item.key} style={styles.mediaThumb}>
                      <Image
                        source={{ uri: item.uri }}
                        style={styles.mediaThumbImage}
                        contentFit="cover"
                      />
                      {uploadProgressById[item.key] != null && (
                        <View style={styles.uploadProgressOverlay}>
                          <Text style={styles.uploadProgressText}>
                            {uploadProgressById[item.key]}%
                          </Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={[styles.mediaRemoveBtn, { backgroundColor: theme.surface }]}
                        onPress={() => removeMediaItem(item.key)}
                        hitSlop={8}
                      >
                        <X size={12} color={theme.text} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
              <View style={styles.inputRow}>
                <TouchableOpacity
                  style={[styles.imageBtn, { backgroundColor: theme.surfaceMuted }]}
                  onPress={handlePickImages}
                  disabled={isPending || mediaItems.length >= 4}
                >
                  <ImagePlus size={18} color={theme.textSecondary} />
                </TouchableOpacity>
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
                    color={
                      text.trim() || mediaItems.length > 0 ? theme.onPrimary : theme.textSecondary
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
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
    gap: 8,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 21,
  },
  messageImages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  messageImage: {
    width: 96,
    height: 96,
    borderRadius: 10,
  },
  replyBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  inputArea: {
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
  mediaStrip: {
    gap: 8,
    paddingRight: 2,
  },
  mediaThumb: {
    width: 58,
    height: 58,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mediaThumbImage: {
    width: '100%',
    height: '100%',
  },
  mediaRemoveBtn: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadProgressOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadProgressText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thinkingContainer: {
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 6,
  },
  thinkingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 36,
  },
  thinkingTitle: {
    fontSize: 13,
  },
  thinkingContent: {
    fontSize: 13,
    lineHeight: 19.5,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  skeletonContainer: {
    gap: 10,
    paddingVertical: 4,
  },
  skeletonBubble: {
    maxWidth: '84%',
  },
  skeletonShort: {
    width: '55%',
    height: 36,
  },
  skeletonMedium: {
    width: '42%',
    height: 36,
  },
  skeletonTall: {
    width: '78%',
    height: 72,
  },
})
