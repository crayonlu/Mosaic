import { toast } from '@/components/ui'
import { MediaPreviewModal } from '@/components/ui/media/MediaPreviewModal'
import { resolveMediaSource } from '@/components/ui/media/mediaPreviewUtils'
import type { ResolvedMediaSource } from '@/components/ui/media/types'
import type { MediaGridItem } from '@/components/ui/DraggableImageGrid'
import { useAuthHeaders } from '@/hooks/useAuthHeaders'
import { useTranslation } from 'react-i18next'
import {
  createSelectedMediaItems,
  uploadSelectedMedia,
  type SelectedMediaItem,
} from '@/lib/media/upload'
import {
  SafeKeyboardAwareScrollView,
  SafeKeyboardProvider,
  SafeKeyboardStickyView,
} from '@/lib/native/safeProviders'
import { useBotThread, useReplyToBot } from '@/lib/query'
import { useBotChatStore } from '@/stores/botChatStore'
import { useThemeStore } from '@/stores/themeStore'
import { resourcesApi, type BotReply, type BotThreadMessage } from '@mosaic/api'
import * as Crypto from 'expo-crypto'
import { useImageQualityStore } from '@/stores/imageQualityStore'
import { Image } from 'expo-image'
import { ChevronDown, ChevronUp, ImagePlus, Lightbulb, Send, X } from 'lucide-react-native'
import { type ComponentRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type DisplayMessage = BotThreadMessage & { previewUris?: string[] }

function ThinkingContentBlock({ content, theme }: { content: string; theme: any }) {
  const [expanded, setExpanded] = useState(false)
  const { t } = useTranslation()
  return (
    <View style={[styles.thinkingContainer, { backgroundColor: theme.surfaceMuted }]}>
      <TouchableOpacity
        onPress={() => setExpanded(v => !v)}
        style={styles.thinkingHeader}
        activeOpacity={0.7}
        accessibilityLabel={t('botThread.toggleThinking')}
      >
        <Lightbulb size={14} color={theme.textSecondary} />
        <Text style={[styles.thinkingTitle, { color: theme.textSecondary }]}>
          {t('botThread.thinkingTitle')}
        </Text>
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

function SkeletonBubbles() {
  const { theme } = useThemeStore()
  const opacity = useSharedValue(0.4)

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }),
        withTiming(0.4, { duration: 800, easing: Easing.out(Easing.cubic) })
      ),
      -1,
      false
    )
  }, [opacity])

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <View style={styles.skeletonContainer}>
      <View style={[styles.messageRow, styles.userMessageRow]}>
        <Animated.View
          style={[
            styles.skeletonBubble,
            styles.skeletonShort,
            { backgroundColor: theme.surfaceMuted, borderRadius: theme.radius.medium },
            animStyle,
          ]}
        />
      </View>
      <View style={styles.messageRow}>
        <Animated.View
          style={[
            styles.skeletonBubble,
            styles.skeletonTall,
            { backgroundColor: theme.surfaceMuted, borderRadius: theme.radius.medium },
            animStyle,
          ]}
        />
      </View>
      <View style={[styles.messageRow, styles.userMessageRow]}>
        <Animated.View
          style={[
            styles.skeletonBubble,
            styles.skeletonMedium,
            { backgroundColor: theme.surfaceMuted, borderRadius: theme.radius.medium },
            animStyle,
          ]}
        />
      </View>
    </View>
  )
}

interface BotThreadSheetProps {
  visible: boolean
  reply: BotReply | null
  onClose: () => void
}

export function BotThreadSheet({ visible, reply, onClose }: BotThreadSheetProps) {
  const { t } = useTranslation()
  const { theme } = useThemeStore()
  const useHighQuality = useImageQualityStore(state => state.useHighQualityImages)
  const insets = useSafeAreaInsets()
  const conversationKey = reply ? `${reply.memoId}:${reply.bot.id}` : ''
  const pendingRequest = useBotChatStore(s =>
    conversationKey ? s.pendingByThread[conversationKey] : undefined
  )
  const setPending = useBotChatStore(s => s.setPending)
  const clearPending = useBotChatStore(s => s.clearPending)
  const { mutateAsync: replyToBot, isPending } = useReplyToBot()
  const {
    data: thread,
    isLoading,
    refetch,
  } = useBotThread(reply?.latestReplyId ?? reply?.id, {
    refetchInterval: query => {
      const hasServerPending = query.state.data?.messages.some(
        m => m.role === 'assistant' && m.status === 'pending'
      )
      return visible && (hasServerPending || Boolean(pendingRequest)) ? 1500 : false
    },
  })
  const scrollViewRef = useRef<any>(null)
  const [text, setText] = useState('')
  const [mediaItems, setMediaItems] = useState<MediaGridItem[]>([])
  const [uploadCandidates, setUploadCandidates] = useState<Record<string, SelectedMediaItem>>({})
  const { headers: authHeaders } = useAuthHeaders()
  const [uploadProgressItems, setUploadProgressItems] = useState<
    { id: string; progress: number }[]
  >([])
  const [imagePreview, setImagePreview] = useState<{
    items: ResolvedMediaSource[]
    index: number
  } | null>(null)
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null)
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (!visible) {
      setText('')
      setMediaItems([])
      setUploadCandidates({})
      setUploadProgressItems([])
      setImagePreview(null)
      inputRef.current?.blur()
    }
  }, [visible])

  const bot = thread?.bot ?? reply?.bot
  const latestReplyId = thread?.latestReplyId ?? reply?.latestReplyId ?? reply?.id
  const serverMessages = useMemo(() => thread?.messages ?? [], [thread?.messages])
  const serverPending = serverMessages.some(
    message => message.role === 'assistant' && message.status === 'pending'
  )
  const isReplying = Boolean(pendingRequest) || isPending || serverPending
  const pendingOnServer = pendingRequest
    ? serverMessages.some(message => message.clientRequestId === pendingRequest.requestId)
    : false
  const pendingUserMessage: DisplayMessage | null =
    pendingRequest && !pendingOnServer
      ? {
          id: `pending-${pendingRequest.requestId}`,
          role: 'user',
          content: pendingRequest.content,
          resourceIds: [],
          status: 'pending',
          createdAt: pendingRequest.createdAt,
          previewUris: pendingRequest.previewUris,
        }
      : null
  const messages: DisplayMessage[] = pendingUserMessage
    ? [...serverMessages, pendingUserMessage]
    : serverMessages
  const uploadProgressById = useMemo(
    () => Object.fromEntries(uploadProgressItems.map(item => [item.id, item.progress])),
    [uploadProgressItems]
  )

  useEffect(() => {
    if (!pendingRequest) return
    const settled = serverMessages.some(
      message =>
        message.clientRequestId === pendingRequest.requestId &&
        message.role === 'assistant' &&
        message.status !== 'pending'
    )
    if (settled) clearPending(conversationKey)
  }, [clearPending, conversationKey, pendingRequest, serverMessages])

  useEffect(() => {
    if (!pendingRequest || pendingOnServer) return
    if (Date.now() - pendingRequest.createdAt < 120_000) return
    setText(pendingRequest.content)
    clearPending(conversationKey)
    toast.error(t('botThread.sendFailed'))
  }, [clearPending, conversationKey, pendingOnServer, pendingRequest, t])

  const scrollToLatest = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated })
    })
  }, [])

  useEffect(() => {
    if (!visible) return
    scrollToLatest(false)
  }, [isReplying, messages.length, scrollToLatest, visible])

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
      toast.error(t('botThread.maxImages'))
      return
    }

    const selected = (await createSelectedMediaItems(result.assets)).slice(0, slots)
    setUploadCandidates(prev => ({
      ...prev,
      ...Object.fromEntries(selected.map(item => [item.key, item])),
    }))
    setMediaItems(prev => [...prev, ...selected])
  }, [mediaItems.length, t])

  const handleSend = useCallback(async () => {
    const question = text.trim()
    if (
      !latestReplyId ||
      (!question && mediaItems.length === 0) ||
      isReplying ||
      inFlightRef.current
    ) {
      return
    }
    inFlightRef.current = true

    const requestId = Crypto.randomUUID()
    const sentText = question || t('botThread.imageReplyPrompt')
    const sentMediaItems = mediaItems
    const sentUploadCandidates = uploadCandidates

    setText('')
    setMediaItems([])
    setUploadCandidates({})
    setPending({
      requestId,
      threadId: conversationKey,
      content: sentText,
      previewUris: sentMediaItems.map(item => item.uri),
      createdAt: Date.now(),
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

      const result = await replyToBot({
        replyId: latestReplyId,
        data: {
          question: sentText,
          resourceIds,
          clientRequestId: requestId,
        },
      })
      if (!result.status || result.status === 'completed') {
        clearPending(conversationKey)
      }
      void refetch()
    } catch (error) {
      let reachedServer = false
      try {
        const result = await refetch()
        reachedServer = Boolean(
          result.data?.messages.some(message => message.clientRequestId === requestId)
        )
      } catch {
        reachedServer = false
      }
      if (!reachedServer) {
        setText(question)
        setMediaItems(sentMediaItems)
        setUploadCandidates(sentUploadCandidates)
        clearPending(conversationKey)
      }
      toast.error(error instanceof Error ? error.message : t('botThread.sendFailed'))
    } finally {
      inFlightRef.current = false
      setUploadProgressItems([])
    }
  }, [
    clearPending,
    conversationKey,
    isReplying,
    latestReplyId,
    mediaItems,
    refetch,
    replyToBot,
    setPending,
    t,
    text,
    uploadCandidates,
  ])

  const removeMediaItem = useCallback((key: string) => {
    setMediaItems(prev => prev.filter(item => item.key !== key))
    setUploadCandidates(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        statusBarTranslucent
        onRequestClose={onClose}
      >
        <SafeKeyboardProvider>
          <StatusBar barStyle="dark-content" />
          <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.content}>
              <View
                style={[
                  styles.header,
                  { borderBottomColor: theme.border, paddingTop: insets.top + 12 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: theme.text }]}>{bot?.name ?? 'Bot'}</Text>
                  <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                    {t('botThread.continueChat')}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={12}>
                  <X size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <SafeKeyboardAwareScrollView
                ref={scrollViewRef}
                style={styles.body}
                contentContainerStyle={styles.messages}
                keyboardShouldPersistTaps="handled"
              >
                {isLoading ? (
                  <SkeletonBubbles />
                ) : (
                  <>
                    {messages.map((message, index) => {
                      const isUser = message.role === 'user'
                      if (message.role === 'assistant' && message.status === 'pending') {
                        return null
                      }
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
                                {
                                  color:
                                    message.status === 'failed'
                                      ? theme.error
                                      : isUser
                                        ? theme.onPrimary
                                        : theme.text,
                                },
                              ]}
                            >
                              {message.status === 'failed'
                                ? (message.errorMessage ?? t('botThread.sendFailed'))
                                : message.content}
                            </Text>
                            {!isUser && 'thinkingContent' in message && message.thinkingContent && (
                              <ThinkingContentBlock
                                content={message.thinkingContent}
                                theme={theme}
                              />
                            )}
                            {(() => {
                              const mediaItems =
                                message.resourceIds.length > 0
                                  ? message.resourceIds.map(resourceId => ({
                                      key: resourceId,
                                      uri: resourcesApi.getDownloadUrl(resourceId),
                                      type: 'image' as const,
                                      headers: authHeaders,
                                    }))
                                  : (message.previewUris ?? []).map(uri => ({
                                      key: uri,
                                      uri,
                                      type: 'image' as const,
                                    }))
                              if (mediaItems.length === 0) return null
                              const mediaSources = mediaItems.map(item =>
                                resolveMediaSource(item, authHeaders)
                              )
                              return (
                                <View style={styles.messageImages}>
                                  {mediaSources.map((source, imageIndex) => {
                                    const highQuality =
                                      message.resourceIds.length > 0 && useHighQuality
                                    return (
                                      <TouchableOpacity
                                        key={source.item.key}
                                        activeOpacity={0.85}
                                        accessibilityRole="imagebutton"
                                        onPress={() =>
                                          setImagePreview({
                                            items: mediaSources,
                                            index: imageIndex,
                                          })
                                        }
                                      >
                                        <Image
                                          source={{
                                            uri: highQuality
                                              ? source.previewUri
                                              : (source.gridUri ?? source.previewUri),
                                            headers: highQuality
                                              ? source.previewHeaders
                                              : source.gridHeaders,
                                          }}
                                          style={styles.messageImage}
                                          contentFit="cover"
                                        />
                                      </TouchableOpacity>
                                    )
                                  })}
                                </View>
                              )
                            })()}
                          </View>
                        </View>
                      )
                    })}
                    {isReplying && (
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
                            {t('botThread.replying')}
                          </Text>
                        </View>
                      </View>
                    )}
                  </>
                )}
              </SafeKeyboardAwareScrollView>
              <SafeKeyboardStickyView>
                <View
                  style={[
                    styles.replyBar,
                    {
                      backgroundColor: theme.background,
                      borderTopColor: theme.border,
                      paddingBottom: Math.max(insets.bottom, 8),
                    },
                  ]}
                >
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
                      style={styles.imageBtn}
                      onPress={handlePickImages}
                      disabled={isReplying || mediaItems.length >= 4}
                      hitSlop={8}
                    >
                      <ImagePlus size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                    <TextInput
                      ref={inputRef}
                      style={[
                        styles.input,
                        { color: theme.text, fontSize: theme.typography.bodyLarge.fontSize },
                      ]}
                      value={text}
                      onChangeText={setText}
                      placeholder={t('botThread.askPlaceholder')}
                      placeholderTextColor={theme.textSecondary}
                      multiline
                      textAlignVertical="top"
                      maxLength={500}
                      editable={!isReplying}
                      blurOnSubmit={false}
                    />
                    <TouchableOpacity
                      style={[
                        styles.sendBtn,
                        {
                          backgroundColor:
                            text.trim() || mediaItems.length > 0
                              ? theme.primary
                              : theme.surfaceMuted,
                        },
                      ]}
                      onPress={handleSend}
                      disabled={(!text.trim() && mediaItems.length === 0) || isReplying}
                      hitSlop={8}
                    >
                      <Send
                        size={18}
                        color={
                          text.trim() || mediaItems.length > 0
                            ? theme.onPrimary
                            : theme.textSecondary
                        }
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </SafeKeyboardStickyView>
            </View>
          </View>
          {imagePreview ? (
            <MediaPreviewModal
              items={imagePreview.items}
              initialIndex={imagePreview.index}
              onRequestClose={() => setImagePreview(null)}
            />
          ) : null}
        </SafeKeyboardProvider>
      </Modal>
    </>
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
    paddingHorizontal: 14,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
  },
  imageBtn: {
    padding: 8,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    paddingVertical: 8,
    paddingHorizontal: 0,
    includeFontPadding: false,
  },
  mediaStrip: {
    gap: 8,
    paddingRight: 2,
    paddingBottom: 2,
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
    ...StyleSheet.absoluteFill,
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
    width: 32,
    height: 32,
    borderRadius: 16,
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
