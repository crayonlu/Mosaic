export interface Bot {
  id: string
  name: string
  avatarUrl?: string
  description: string
  tags: string[]
  autoReply: boolean
  visionEnabled: boolean
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface BotSummary {
  id: string
  name: string
  avatarUrl?: string
  visionEnabled: boolean
}

export interface BotReply {
  id: string
  memoId: string
  bot: BotSummary
  content: string
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
  visionEnabled: boolean
}

export interface UpdateBotRequest {
  name?: string
  avatarUrl?: string | null
  description?: string
  tags?: string[]
  autoReply?: boolean
  visionEnabled?: boolean
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
  'x-ai-supports-vision': string
  [key: string]: string
}
