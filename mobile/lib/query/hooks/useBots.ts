import { getAIConfig } from '@/lib/ai'
import type {
  AiHeaders,
  CreateBotRequest,
  ReorderBotsRequest,
  ReplyToBotRequest,
  UpdateBotRequest,
} from '@mosaic/api'
import { botsApi } from '@mosaic/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

async function buildAiHeaders(): Promise<AiHeaders | null> {
  const config = await getAIConfig()
  if (!config.apiKey?.trim()) return null
  return {
    'x-ai-provider': config.provider,
    'x-ai-base-url': config.baseUrl,
    'x-ai-api-key': config.apiKey,
    'x-ai-model': config.model,
  }
}

export function useBots() {
  return useQuery({
    queryKey: ['bots'],
    queryFn: () => botsApi.list(),
    staleTime: 60 * 1000,
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
    mutationFn: async (memoId: string) => {
      const aiHeaders = await buildAiHeaders()
      if (!aiHeaders) return
      await botsApi.triggerReplies(memoId, aiHeaders)
    },
  })
}

export function useReplyToBot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ replyId, data }: { replyId: string; data: ReplyToBotRequest }) => {
      const aiHeaders = await buildAiHeaders()
      if (!aiHeaders) throw new Error('AI 未配置，无法回复')
      return botsApi.replyToBot(replyId, data, aiHeaders)
    },
    onSuccess: newReply => {
      queryClient.invalidateQueries({ queryKey: ['bot-replies', newReply.memoId] })
      queryClient.invalidateQueries({ queryKey: ['bot-thread'] })
    },
  })
}
