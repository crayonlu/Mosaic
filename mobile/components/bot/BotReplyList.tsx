import { toast } from '@/components/ui/Toast'
import { useBotReplies, useReplyToBot } from '@/lib/query'
import { useThemeStore } from '@/stores/themeStore'
import type { BotReply } from '@mosaic/api'
import { useCallback, useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { BotReplyCard } from './BotReplyCard'

interface BotReplyListProps {
  memoId: string
}

export function BotReplyList({ memoId }: BotReplyListProps) {
  const { theme } = useThemeStore()
  const { data: replies = [], refetch } = useBotReplies(memoId)
  const { mutateAsync: replyToBot, isPending: isReplying } = useReplyToBot()

  const [targetReply, setTargetReply] = useState<BotReply | null>(null)
  const [question, setQuestion] = useState('')
  const inputRef = useRef<TextInput>(null)

  const handleReply = useCallback((reply: BotReply) => {
    setTargetReply(reply)
    setQuestion('')
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [])

  const handleDismiss = useCallback(() => {
    setTargetReply(null)
    setQuestion('')
    inputRef.current?.blur()
  }, [])

  const handleSend = useCallback(async () => {
    if (!targetReply || !question.trim()) return
    try {
      await replyToBot({ replyId: targetReply.id, question: question.trim() })
      setTargetReply(null)
      setQuestion('')
      await refetch()
    } catch (error) {
      const msg = error instanceof Error ? error.message : '发送失败'
      toast.error(msg)
    }
  }, [targetReply, question, replyToBot, refetch])

  if (replies.length === 0 && !targetReply) {
    return null
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.wrapper}
    >
      {replies.length > 0 && (
        <View style={[styles.section, { borderTopColor: theme.border }]}>
          {replies.map((reply, index) => (
            <View
              key={reply.id}
              style={[
                styles.replyWrapper,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: theme.border,
                },
              ]}
            >
              <BotReplyCard reply={reply} onReply={handleReply} />
            </View>
          ))}
        </View>
      )}

      {targetReply && (
        <View
          style={[
            styles.inputArea,
            { borderTopColor: theme.border, backgroundColor: theme.surface },
          ]}
        >
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.surfaceMuted,
                },
              ]}
              value={question}
              onChangeText={setQuestion}
              placeholder={`回复 ${targetReply.bot.name}...`}
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={500}
              onBlur={handleDismiss}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                { backgroundColor: question.trim() ? theme.primary : theme.surfaceMuted },
              ]}
              onPress={handleSend}
              disabled={!question.trim() || isReplying}
            >
              <Text
                style={[
                  styles.sendBtnText,
                  { color: question.trim() ? theme.onPrimary : theme.textSecondary },
                ]}
              >
                {isReplying ? '...' : '发送'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 8,
  },
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyWrapper: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 10,
    gap: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
})
