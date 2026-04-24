export interface Bot {
  id: string
  name: string
  avatarUrl?: string
  description: string
  tags: string[]
  autoReply: boolean
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface BotSummary {
  id: string
  name: string
  avatarUrl?: string
}

export interface BotReply {
  id: string
  memoId: string
  bot: BotSummary
  content: string
  thinkingContent?: string
  parentReplyId: string | null
  userQuestion: string | null
  createdAt: number
  children: BotReply[]
  threadCount: number
  latestReplyId: string
}

export interface BotThreadMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinkingContent?: string
  resourceIds: string[]
  createdAt: number
}

export interface BotThread {
  memoId: string
  bot: BotSummary
  messages: BotThreadMessage[]
  latestReplyId: string
}

export interface CreateBotRequest {
  name: string
  avatarUrl?: string
  description: string
  tags: string[]
  autoReply: boolean
}

export interface UpdateBotRequest {
  name?: string
  avatarUrl?: string | null
  description?: string
  tags?: string[]
  autoReply?: boolean
  sortOrder?: number
}

export interface ReorderBotsRequest {
  order: string[]
}

export interface ReplyToBotRequest {
  question: string
  resourceIds?: string[]
}

export interface AiHeaders {
  'x-ai-provider': string
  'x-ai-base-url': string
  'x-ai-api-key': string
  'x-ai-model': string
  [key: string]: string
}
