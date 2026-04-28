import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { botsApi } from '../bots'
import type {
  CreateBotRequest,
  ReorderBotsRequest,
  ReplyToBotRequest,
  UpdateBotRequest,
} from '../types'

const BOT_STALE_TIME = 60 * 1000

export function useBots() {
  return useQuery({
    queryKey: ['bots'],
    queryFn: () => botsApi.list(),
    staleTime: BOT_STALE_TIME,
  })
}

export function useBotReplies(memoId: string) {
  return useQuery({
    queryKey: ['bot-replies', memoId],
    queryFn: () => botsApi.getBotReplies(memoId),
    staleTime: 0,
    enabled: !!memoId,
  })
}

export function useBotThread(replyId?: string | null) {
  return useQuery({
    queryKey: ['bot-thread', replyId],
    queryFn: () => botsApi.getBotThread(replyId as string),
    staleTime: 0,
    enabled: !!replyId,
  })
}

export function useCreateBot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateBotRequest) => botsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
    },
  })
}

export function useUpdateBot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBotRequest }) => botsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
    },
  })
}

export function useDeleteBot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => botsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
    },
  })
}

export function useReorderBots() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ReorderBotsRequest) => botsApi.reorder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
    },
  })
}

export function useTriggerReplies() {
  return useMutation({
    mutationFn: (memoId: string) => botsApi.triggerReplies(memoId),
  })
}

export function useReplyToBot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ replyId, data }: { replyId: string; data: ReplyToBotRequest }) =>
      botsApi.replyToBot(replyId, data),
    onSuccess: newReply => {
      queryClient.invalidateQueries({ queryKey: ['bot-replies', newReply.memoId] })
      queryClient.invalidateQueries({ queryKey: ['bot-thread'] })
    },
  })
}
