import { apiClient } from './client'
import type {
  Bot,
  BotReply,
  BotThread,
  CreateBotRequest,
  ReorderBotsRequest,
  ReplyToBotRequest,
  UpdateBotRequest,
} from './types'

export const botsApi = {
  list(): Promise<Bot[]> {
    return apiClient.get<Bot[]>('/api/bots')
  },

  create(data: CreateBotRequest): Promise<Bot> {
    return apiClient.post<Bot>('/api/bots', data)
  },

  update(id: string, data: UpdateBotRequest): Promise<Bot> {
    return apiClient.put<Bot>(`/api/bots/${id}`, data)
  },

  delete(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/bots/${id}`)
  },

  reorder(data: ReorderBotsRequest): Promise<void> {
    return apiClient.put<void>('/api/bots/reorder', data)
  },

  getBotReplies(memoId: string): Promise<BotReply[]> {
    return apiClient.get<BotReply[]>(`/api/memos/${memoId}/bot-replies`)
  },

  getBotThread(replyId: string): Promise<BotThread> {
    return apiClient.get<BotThread>(`/api/bot-replies/${replyId}/thread`)
  },

  triggerReplies(memoId: string): Promise<void> {
    return apiClient.post<void>(`/api/memos/${memoId}/trigger-replies`)
  },

  replyToBot(replyId: string, data: ReplyToBotRequest): Promise<BotReply> {
    return apiClient.post<BotReply>(`/api/bot-replies/${replyId}/reply`, data)
  },
}
