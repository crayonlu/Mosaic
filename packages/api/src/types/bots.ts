export interface Bot {
  id: string
  name: string
  avatarUrl?: string
  description: string
  tags: string[]
  autoReply: boolean
  sortOrder: number
  model?: string
  aiConfig?: any
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
  model?: string
  aiConfig?: any
}

export interface UpdateBotRequest {
  name?: string
  avatarUrl?: string | null
  description?: string
  tags?: string[]
  autoReply?: boolean
  sortOrder?: number
  model?: string | null
  aiConfig?: any | null
}

export interface ReorderBotsRequest {
  order: string[]
}

export interface ReplyToBotRequest {
  question: string
  resourceIds?: string[]
}
