import { invoke } from '@tauri-apps/api/core'
import type { TokenStorage } from '../client'

export interface TauriPluginOptions {
  tokenStorage?: TokenStorage
}

export class TauriApiClient {
  private static instance: TauriApiClient | null = null

  static getInstance(): TauriApiClient {
    if (!TauriApiClient.instance) {
      TauriApiClient.instance = new TauriApiClient()
    }
    return TauriApiClient.instance
  }

  static isAvailable(): boolean {
    try {
      return typeof window !== 'undefined' && '__TAURI__' in window
    } catch {
      return false
    }
  }

  async invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    return invoke<T>(cmd, args)
  }

  async getServerConfig(): Promise<{ url: string; username: string }> {
    return this.invoke('get_server_config')
  }

  async setServerConfig(config: {
    url: string
    username: string
    password: string
  }): Promise<void> {
    return this.invoke('set_server_config', { serverConfig: config })
  }

  async testServerConnection(serverConfig: {
    url: string
    username: string
    password: string
    aiProvider?: string
    aiBaseUrl?: string
    aiApiKey?: string
  }): Promise<boolean> {
    return this.invoke('test_server_connection', { serverConfig })
  }

  async login(
    username: string,
    password: string
  ): Promise<{ accessToken: string; refreshToken: string; user: unknown }> {
    return this.invoke('login', { username, password })
  }

  async logout(): Promise<void> {
    return this.invoke('logout')
  }

  async getMemosByDiaryDate(diaryDate: string): Promise<unknown[]> {
    return this.invoke('get_memos_by_diary_date', { diaryDate })
  }

  async refreshToken(): Promise<{ accessToken: string; refreshToken: string }> {
    return this.invoke('refresh_token')
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    return this.invoke('change_password', { oldPassword, newPassword })
  }

  async getSetting(key: string): Promise<{
    id: string
    key: string
    value: string
    category: string
    createdAt: number
    updatedAt: number
  } | null> {
    return this.invoke('get_setting', { key })
  }

  async getSettings(category?: string): Promise<
    Array<{
      id: string
      key: string
      value: string
      category: string
      createdAt: number
      updatedAt: number
    }>
  > {
    void category
    return this.invoke('get_settings')
  }

  async setSetting(req: { key: string; value: string; category: string }): Promise<{
    id: string
    key: string
    value: string
    category: string
    createdAt: number
    updatedAt: number
  }> {
    return this.invoke('set_setting', {
      key: req.key,
      value: { value: req.value },
    })
  }

  async deleteSetting(key: string): Promise<void> {
    return this.invoke('delete_setting', { key })
  }

  async testAIConnection(provider: string, baseUrl: string, apiKey: string): Promise<boolean> {
    void provider
    void baseUrl
    void apiKey
    return this.invoke('test_ai_connection')
  }

  async enableAutostart(enabled: boolean): Promise<void> {
    return this.invoke('enable_autostart', { enabled })
  }

  async isAutostartEnabled(): Promise<boolean> {
    return this.invoke('is_autostart_enabled')
  }

  async registerShowShortcut(shortcut: string): Promise<void> {
    void shortcut
    return this.invoke('register_show_shortcut')
  }

  async registerCloseShortcut(shortcut: string): Promise<void> {
    void shortcut
    return this.invoke('register_close_shortcut')
  }

  async unregisterShortcut(shortcut: string): Promise<void> {
    void shortcut
    return this.invoke('unregister_shortcut')
  }

  async getDataDirectory(): Promise<string> {
    return this.invoke('get_data_directory')
  }

  async getDefaultDataDirectory(): Promise<string> {
    return this.invoke('get_default_data_directory')
  }

  async setDataDirectory(newDirectoryPath: string): Promise<void> {
    return this.invoke('set_data_directory', { newDirectoryPath })
  }

  async needsDataMigration(): Promise<boolean> {
    return this.invoke('needs_data_migration')
  }

  async completeText(req: {
    content: string
    context?: string
  }): Promise<{ generatedText: string }> {
    return this.invoke('complete_text', req)
  }

  async rewriteText(req: { text: string; style?: string }): Promise<{ rewrittenText: string }> {
    return this.invoke('rewrite_text', req)
  }

  async summarizeText(req: { text: string; maxLength?: number }): Promise<{ summary: string }> {
    return this.invoke('summarize_text', req)
  }

  async suggestTags(req: {
    content: string
    existingTags?: string[]
  }): Promise<{ tags: string[] }> {
    return this.invoke('suggest_tags', req)
  }

  async getSyncStatus(): Promise<{ status: string; timestamp: string; error?: string }> {
    return this.invoke('get_sync_status')
  }

  async checkConnection(): Promise<boolean> {
    return this.invoke('check_connection')
  }

  async triggerSync(): Promise<void> {
    return this.invoke('trigger_sync')
  }

  async getResource(id: string): Promise<unknown> {
    return this.invoke('get_resource', { id })
  }

  async deleteAssetFile(filename: string): Promise<void> {
    return this.invoke('delete_asset_file', { filename })
  }

  async uploadFiles(
    files: { name: string; data: number[]; mime_type?: string }[],
    memoId?: string
  ): Promise<unknown[]> {
    return this.invoke('upload_files', { files, memoId })
  }

  async saveTempFile(filename: string, data: number[]): Promise<string> {
    return this.invoke('save_temp_file', { filename, data })
  }

  async getPresignedImageUrl(resourceId: string): Promise<string> {
    return this.invoke('get_presigned_image_url', { id: resourceId })
  }

  async getUser(): Promise<unknown> {
    return this.invoke('get_user')
  }

  async getOrCreateDefaultUser(): Promise<unknown> {
    return this.invoke('get_or_create_default_user')
  }

  async updateUser(req: { username?: string; avatar_url?: string }): Promise<unknown> {
    return this.invoke('update_user', { req })
  }

  async uploadAvatar(file: { name: string; data: number[]; mimeType: string }): Promise<unknown> {
    return this.invoke('upload_avatar', { file })
  }

  async getMemo(id: string): Promise<unknown> {
    return this.invoke('get_memo', { memoId: id })
  }

  async listMemos(query?: Record<string, unknown>): Promise<unknown> {
    return this.invoke('list_memos', {
      page: query?.page,
      pageSize: query?.pageSize,
      isArchived: query?.isArchived,
    })
  }

  async getMemosByDate(date: string): Promise<unknown[]> {
    return this.invoke('get_memos_by_date', { date })
  }

  async createMemo(req: {
    content: string
    tags?: string[]
    diaryDate?: string
  }): Promise<unknown> {
    return this.invoke('create_memo', { req })
  }

  async updateMemo(id: string, req: Record<string, unknown>): Promise<unknown> {
    return this.invoke('update_memo', { req: { ...req, id } })
  }

  async deleteMemo(id: string): Promise<void> {
    return this.invoke('delete_memo', { memoId: id })
  }

  async archiveMemo(id: string, diaryDate?: string): Promise<void> {
    void diaryDate
    return this.invoke('archive_memo', { memoId: id })
  }

  async unarchiveMemo(id: string): Promise<void> {
    return this.invoke('unarchive_memo', { memoId: id })
  }

  async searchMemos(query: Record<string, unknown>): Promise<unknown> {
    return this.invoke('search_memos', { req: query })
  }

  async getDiaryByDate(date: string): Promise<unknown> {
    return this.invoke('get_diary_by_date', { date })
  }

  async listDiaries(query?: Record<string, unknown>): Promise<unknown> {
    return this.invoke('list_diaries', {
      page: query?.page,
      pageSize: query?.pageSize,
      startDate: query?.startDate ?? query?.start_date,
      endDate: query?.endDate ?? query?.end_date,
    })
  }

  async createOrUpdateDiary(req: {
    date: string
    summary?: string
    moodKey?: string
    moodScore?: number
  }): Promise<unknown> {
    const { date, ...rest } = req
    return this.invoke('create_or_update_diary', { date, req: rest })
  }

  async updateDiarySummary(date: string, req: { summary: string }): Promise<unknown> {
    return this.invoke('update_diary_summary', { req: { date, summary: req.summary } })
  }

  async updateDiaryMood(
    date: string,
    req: { moodKey: string; moodScore: number }
  ): Promise<unknown> {
    return this.invoke('update_diary_mood', {
      req: {
        date,
        moodKey: req.moodKey,
        moodScore: req.moodScore,
      },
    })
  }

  async getHeatmap(query: Record<string, unknown>): Promise<unknown> {
    return this.invoke('get_heatmap', {
      startDate: query.startDate ?? query.start_date,
      endDate: query.endDate ?? query.end_date,
    })
  }

  async getTimeline(query: Record<string, unknown>): Promise<unknown> {
    return this.invoke('get_timeline', {
      startDate: query.startDate ?? query.start_date,
      endDate: query.endDate ?? query.end_date,
    })
  }

  async getTrends(query: Record<string, unknown>): Promise<unknown> {
    return this.invoke('get_trends', {
      startDate: query.startDate ?? query.start_date,
      endDate: query.endDate ?? query.end_date,
    })
  }

  async getSummary(query: Record<string, unknown>): Promise<unknown> {
    return this.invoke('get_summary', {
      year: query.year,
      month: query.month,
    })
  }
}

export const tauriApiClient = TauriApiClient.getInstance()
