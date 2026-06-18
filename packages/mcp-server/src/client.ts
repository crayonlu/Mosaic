/**
 * Minimal HTTP client for the Mosaic REST API.
 * Designed for Node.js/Bun server-side use (no React Native dependencies).
 */
import type {
  AdminAiConfigResponse,
  Bot,
  BotReply,
  BotThread,
  DiaryResponse,
  DiaryWithMemosResponse,
  HeatMapData,
  ListMemosQuery,
  ListDiariesQuery,
  LoginResponse,
  MemoContextsResponse,
  MemoryActivityEntry,
  MemoryContext,
  MemoryStats,
  MemoWithResourcesResponse,
  PaginatedResponse,
  ResourceResponse,
  SearchMemosQuery,
  SearchMemosResponse,
  ServerAiConfigPayload,
  StatsQuery,
  SummaryData,
  SummaryQuery,
  TagResponse,
  TimelineData,
  TrendsData,
} from './mosaic-types.js'

export interface MosaicClientConfig {
  serverUrl: string
  token?: string
  username?: string
  password?: string
}

export class MosaicClient {
  private baseUrl: string
  private token: string | null = null
  private username: string | null = null
  private password: string | null = null

  constructor(config: MosaicClientConfig) {
    this.baseUrl = config.serverUrl.replace(/\/+$/, '')
    this.token = config.token ?? null
    this.username = config.username ?? null
    this.password = config.password ?? null
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    return headers
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.token) return

    if (this.username && this.password) {
      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: this.username, password: this.password }),
      })

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as LoginResponse
      this.token = data.accessToken
    } else {
      throw new Error(
        'No authentication configured. Provide MOSAIC_TOKEN or MOSAIC_USERNAME + MOSAIC_PASSWORD.'
      )
    }

    // Persist token for subsequent requests
  }

  getAccessToken(): string | null {
    return this.token
  }

  setAccessToken(token: string): void {
    this.token = token
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, unknown>
  ): Promise<T> {
    await this.ensureAuthenticated()

    const url = new URL(`${this.baseUrl}${path}`)
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value))
        }
      }
    }

    const headers = await this.getAuthHeaders()

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`Mosaic API error (${response.status}): ${errorText}`)
    }

    if (response.status === 204) {
      return undefined as T
    }

    return response.json() as Promise<T>
  }

  private async get<T>(path: string, query?: Record<string, unknown>): Promise<T> {
    return this.request<T>('GET', path, undefined, query)
  }

  private async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body)
  }

  private async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body)
  }

  private async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path)
  }

  // ── Health ──────────────────────────────────────────
  async health(): Promise<{ status: string; version: string }> {
    return this.get('/health')
  }

  // ── Auth ────────────────────────────────────────────
  async me(): Promise<{ id: string; username: string; avatarUrl?: string }> {
    return this.get('/api/auth/me')
  }

  // ── Memos ───────────────────────────────────────────
  async listMemos(query?: ListMemosQuery): Promise<PaginatedResponse<MemoWithResourcesResponse>> {
    return this.get('/api/memos', query as Record<string, unknown>)
  }

  async getMemo(id: string): Promise<MemoWithResourcesResponse> {
    return this.get(`/api/memos/${id}`)
  }

  async createMemo(data: {
    content: string
    tags?: string[]
    resourceIds?: string[]
    diaryDate?: string
  }): Promise<MemoWithResourcesResponse> {
    return this.post('/api/memos', data)
  }

  async updateMemo(
    id: string,
    data: {
      content?: string
      tags?: string[]
      resourceIds?: string[]
      isArchived?: boolean
      diaryDate?: string | null
    }
  ): Promise<MemoWithResourcesResponse> {
    return this.put(`/api/memos/${id}`, data)
  }

  async deleteMemo(id: string): Promise<void> {
    return this.delete(`/api/memos/${id}`)
  }

  async archiveMemo(id: string, diaryDate?: string): Promise<void> {
    return this.put(`/api/memos/${id}/archive`, { diaryDate })
  }

  async unarchiveMemo(id: string): Promise<void> {
    return this.put(`/api/memos/${id}/unarchive`)
  }

  async searchMemos(query: SearchMemosQuery): Promise<SearchMemosResponse> {
    return this.get('/api/memos/search', query as Record<string, unknown>)
  }

  async getAllTags(): Promise<TagResponse[]> {
    return this.get('/api/memos/tags')
  }

  async clipToMemo(data: {
    clipType: 'url' | 'text' | 'image'
    url?: string
    content?: string
    resourceId?: string
    userNote?: string
  }): Promise<{
    title: string
    content: string
    aiSummary: string
    tags: string[]
    sourceUrl: string | null
    sourceType: string
  }> {
    return this.post('/api/memos/clip', data)
  }

  // ── Diaries ─────────────────────────────────────────
  async listDiaries(query?: ListDiariesQuery): Promise<PaginatedResponse<DiaryResponse>> {
    return this.get('/api/diaries', query as Record<string, unknown>)
  }

  async getDiary(date: string): Promise<DiaryWithMemosResponse> {
    return this.get(`/api/diaries/${date}`)
  }

  async createOrUpdateDiary(
    date: string,
    data: { summary?: string; moodKey?: string; moodScore?: number }
  ): Promise<DiaryResponse> {
    return this.post(`/api/diaries/${date}`, { ...data, date })
  }

  async updateDiarySummary(date: string, summary: string): Promise<DiaryResponse> {
    return this.put(`/api/diaries/${date}/summary`, { summary })
  }

  async updateDiaryMood(date: string, moodKey: string, moodScore: number): Promise<DiaryResponse> {
    return this.put(`/api/diaries/${date}/mood`, { moodKey, moodScore })
  }

  // ── Bots ───────────────────────────────────────────
  async listBots(): Promise<Bot[]> {
    return this.get('/api/bots')
  }

  async getBotReplies(memoId: string): Promise<BotReply[]> {
    return this.get(`/api/memos/${memoId}/bot-replies`)
  }

  async getBotThread(replyId: string): Promise<BotThread> {
    return this.get(`/api/bot-replies/${replyId}/thread`)
  }

  async triggerBotReplies(memoId: string): Promise<void> {
    return this.post(`/api/memos/${memoId}/trigger-replies`)
  }

  async replyToBot(replyId: string, question: string): Promise<BotReply> {
    return this.post(`/api/bot-replies/${replyId}/reply`, { question })
  }

  // ── Memory ─────────────────────────────────────────
  async getMemoryStats(): Promise<MemoryStats> {
    return this.get('/api/memory/stats')
  }

  async getMemoryActivity(limit = 20): Promise<MemoryActivityEntry[]> {
    return this.get(`/api/memory/activity`, { limit })
  }

  async getMemoryContext(memoId: string, botId: string, limit?: number): Promise<MemoryContext> {
    return this.get(`/api/memory/context`, { memo_id: memoId, bot_id: botId, limit })
  }

  async getMemoContexts(memoId: string, limit?: number): Promise<MemoContextsResponse> {
    return this.get(`/api/memos/${memoId}/memory-contexts`, limit ? { limit } : undefined)
  }

  // ── Stats ──────────────────────────────────────────
  async getHeatmap(query: StatsQuery): Promise<HeatMapData> {
    return this.get('/api/stats/heatmap', query as Record<string, unknown>)
  }

  async getTimeline(query: StatsQuery): Promise<TimelineData> {
    return this.get('/api/stats/timeline', query as Record<string, unknown>)
  }

  async getTrends(query: StatsQuery): Promise<TrendsData> {
    return this.get('/api/stats/trends', query as Record<string, unknown>)
  }

  async getStatsSummary(query: SummaryQuery): Promise<SummaryData> {
    return this.get('/api/stats/summary', query as Record<string, unknown>)
  }

  // ── AI ─────────────────────────────────────────────
  async summarize(content: string): Promise<{ summary: string }> {
    return this.post('/api/ai/summarize', { content })
  }

  async suggestTags(content: string, existingTags: string[] = []): Promise<{ tags: string[] }> {
    return this.post('/api/ai/suggest-tags', { content, existing_tags: existingTags })
  }

  // ── Admin ──────────────────────────────────────────
  async getAiConfig(): Promise<AdminAiConfigResponse> {
    return this.get('/admin/api/ai-config')
  }

  async updateAiConfig(
    key: 'bot' | 'embedding',
    data: ServerAiConfigPayload
  ): Promise<{ key: string; provider: string; model: string }> {
    return this.put(`/admin/api/ai-config/${key}`, data)
  }

  async backfillMemory(): Promise<{ message: string }> {
    return this.post('/admin/api/backfill-memory')
  }

  // ── Resources ──────────────────────────────────────
  async listResources(query?: {
    page?: number
    pageSize?: number
  }): Promise<PaginatedResponse<ResourceResponse>> {
    return this.get('/api/resources', query as Record<string, unknown>)
  }

  async getResource(id: string): Promise<ResourceResponse> {
    return this.get(`/api/resources/${id}`)
  }
}
