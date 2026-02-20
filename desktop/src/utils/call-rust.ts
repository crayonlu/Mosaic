import type {
  AIConfig,
  ServerConfig,
  SetSettingRequest,
  Setting,
  ShortcutConfig,
} from '@/types/settings'
import type { Diary, Memo, User } from '@mosaic/api'
import { tauriApiClient } from '@mosaic/api'

export const configCommands = {
  getServerConfig: () => tauriApiClient.getServerConfig() as Promise<ServerConfig>,
  setServerConfig: (config: ServerConfig) => tauriApiClient.setServerConfig(config),
  testServerConnection: (serverConfig: ServerConfig) =>
    tauriApiClient.testServerConnection(serverConfig),
  login: (username: string, password: string) =>
    tauriApiClient.login(username, password) as Promise<{
      accessToken: string
      refreshToken: string
      user: User
    }>,
  logout: () => tauriApiClient.logout(),
}

export const userCommands = {
  getUser: () => tauriApiClient.getUser() as Promise<User>,
  getOrCreateDefaultUser: () => tauriApiClient.getOrCreateDefaultUser() as Promise<User>,
  updateUser: (req: { username?: string; avatar_url?: string }) =>
    tauriApiClient.updateUser(req) as Promise<User>,
  uploadAvatar: (file: { name: string; data: number[]; mimeType: string }) =>
    tauriApiClient.uploadAvatar(file as any) as Promise<User>,
  login: (username: string, password: string) =>
    tauriApiClient.login(username, password) as Promise<{
      accessToken: string
      refreshToken: string
      user: User
    }>,
  logout: () => tauriApiClient.logout(),
  refreshToken: () =>
    tauriApiClient.refreshToken() as Promise<{ accessToken: string; refreshToken: string }>,
  changePassword: (oldPassword: string, newPassword: string) =>
    tauriApiClient.changePassword(oldPassword, newPassword),
}

export const memoCommands = {
  getMemo: (id: string) => tauriApiClient.getMemo(id) as Promise<Memo>,
  listMemos: (query?: Record<string, unknown>) =>
    tauriApiClient.listMemos(query) as Promise<Memo[]>,
  getMemosByDate: (date: string) => tauriApiClient.getMemosByDate(date) as Promise<Memo[]>,
  getMemosByDiaryDate: (diaryDate: string) =>
    tauriApiClient.getMemosByDiaryDate(diaryDate) as Promise<Memo[]>,
  createMemo: (req: { content: string; tags?: string[]; diaryDate?: string }) =>
    tauriApiClient.createMemo(req) as Promise<Memo>,
  updateMemo: (id: string, req: Record<string, unknown>) =>
    tauriApiClient.updateMemo(id, req) as Promise<Memo>,
  deleteMemo: (id: string) => tauriApiClient.deleteMemo(id),
  archiveMemo: (id: string, diaryDate?: string) => tauriApiClient.archiveMemo(id, diaryDate),
  unarchiveMemo: (id: string) => tauriApiClient.unarchiveMemo(id),
  searchMemos: (query: Record<string, unknown>) =>
    tauriApiClient.searchMemos(query) as Promise<Memo[]>,
}

export const diaryCommands = {
  getDiaryByDate: (date: string) => tauriApiClient.getDiaryByDate(date) as Promise<Diary | null>,
  listDiaries: (query?: Record<string, unknown>) =>
    tauriApiClient.listDiaries(query) as Promise<Diary[]>,
  createOrUpdateDiary: (req: {
    date: string
    summary?: string
    moodKey?: string
    moodScore?: number
  }) => tauriApiClient.createOrUpdateDiary(req) as Promise<Diary>,
  updateDiarySummary: (date: string, req: { summary: string }) =>
    tauriApiClient.updateDiarySummary(date, req) as Promise<Diary>,
  updateDiaryMood: (date: string, req: { moodKey: string; moodScore: number }) =>
    tauriApiClient.updateDiaryMood(date, req) as Promise<Diary>,
}

export const statsCommands = {
  getHeatmap: (query: Record<string, unknown>) => tauriApiClient.getHeatmap(query),
  getTimeline: (query: Record<string, unknown>) => tauriApiClient.getTimeline(query),
  getTrends: (query: Record<string, unknown>) => tauriApiClient.getTrends(query),
  getSummary: (query: Record<string, unknown>) => tauriApiClient.getSummary(query),
}

export const settingsCommands = {
  getSetting: (key: string) => tauriApiClient.getSetting(key) as Promise<Setting | null>,
  getSettings: (category?: string) => tauriApiClient.getSettings(category) as Promise<Setting[]>,
  setSetting: (req: SetSettingRequest) => tauriApiClient.setSetting(req) as Promise<Setting>,
  deleteSetting: (key: string) => tauriApiClient.deleteSetting(key),
  testAIConnection: (provider: string, baseUrl: string, apiKey: string) =>
    tauriApiClient.testAIConnection(provider, baseUrl, apiKey),
  enableAutostart: (enabled: boolean) => tauriApiClient.enableAutostart(enabled),
  isAutostartEnabled: () => tauriApiClient.isAutostartEnabled(),
  registerShowShortcut: (shortcut: string) => tauriApiClient.registerShowShortcut(shortcut),
  registerCloseShortcut: (shortcut: string) => tauriApiClient.registerCloseShortcut(shortcut),
  unregisterShortcut: (shortcut: string) => tauriApiClient.unregisterShortcut(shortcut),
}

export async function loadAIConfig(): Promise<AIConfig | null> {
  try {
    const provider = await settingsCommands.getSetting('ai.provider')
    const baseUrl = await settingsCommands.getSetting('ai.baseUrl')
    const apiKey = await settingsCommands.getSetting('ai.apiKey')
    const model = await settingsCommands.getSetting('ai.model')
    const temperature = await settingsCommands.getSetting('ai.temperature')
    const maxTokens = await settingsCommands.getSetting('ai.maxTokens')
    const timeout = await settingsCommands.getSetting('ai.timeout')

    if (!provider || !baseUrl || !apiKey) {
      return null
    }

    return {
      provider: provider.value as 'openai' | 'anthropic',
      baseUrl: baseUrl.value,
      apiKey: apiKey.value,
      model: model?.value || undefined,
      temperature: temperature ? parseFloat(temperature.value) : undefined,
      maxTokens: maxTokens ? parseInt(maxTokens.value, 10) : undefined,
      timeout: timeout ? parseInt(timeout.value, 10) : undefined,
    }
  } catch (error) {
    console.error('Failed to load AI config:', error)
    return null
  }
}

export async function saveAIConfig(config: AIConfig): Promise<void> {
  await Promise.all([
    settingsCommands.setSetting({ key: 'ai.provider', value: config.provider, category: 'ai' }),
    settingsCommands.setSetting({ key: 'ai.baseUrl', value: config.baseUrl, category: 'ai' }),
    settingsCommands.setSetting({ key: 'ai.apiKey', value: config.apiKey, category: 'ai' }),
    config.model &&
      settingsCommands.setSetting({ key: 'ai.model', value: config.model, category: 'ai' }),
    config.temperature !== undefined &&
      settingsCommands.setSetting({
        key: 'ai.temperature',
        value: config.temperature.toString(),
        category: 'ai',
      }),
    config.maxTokens !== undefined &&
      settingsCommands.setSetting({
        key: 'ai.maxTokens',
        value: config.maxTokens.toString(),
        category: 'ai',
      }),
    config.timeout !== undefined &&
      settingsCommands.setSetting({
        key: 'ai.timeout',
        value: config.timeout.toString(),
        category: 'ai',
      }),
  ])
}

export async function loadShortcutConfig(): Promise<ShortcutConfig | null> {
  try {
    const showShortcut = await settingsCommands.getSetting('shortcut.show')
    const closeShortcut = await settingsCommands.getSetting('shortcut.close')

    if (!showShortcut || !closeShortcut) {
      return null
    }

    return {
      showShortcut: showShortcut.value,
      closeShortcut: closeShortcut.value,
    }
  } catch (error) {
    console.error('Failed to load shortcut config:', error)
    return null
  }
}

export async function saveShortcutConfig(config: ShortcutConfig): Promise<void> {
  await Promise.all([
    settingsCommands.setSetting({
      key: 'shortcut.show',
      value: config.showShortcut,
      category: 'shortcut',
    }),
    settingsCommands.setSetting({
      key: 'shortcut.close',
      value: config.closeShortcut,
      category: 'shortcut',
    }),
  ])
}

export const storageCommands = {
  getDataDirectory: () => tauriApiClient.getDataDirectory(),
  getDefaultDataDirectory: () => tauriApiClient.getDefaultDataDirectory(),
  setDataDirectory: (path: string) => tauriApiClient.setDataDirectory(path),
  needsDataMigration: () => tauriApiClient.needsDataMigration(),
}

export async function selectDataDirectory(): Promise<string | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      title: '选择数据存储位置',
      directory: true,
      multiple: false,
    })
    return selected as string | null
  } catch (error) {
    console.error('Failed to open directory picker:', error)
    return null
  }
}

export const aiCommands = {
  completeText: (req: { content: string; context?: string }) =>
    tauriApiClient.completeText(req) as Promise<{ generatedText: string }>,
  rewriteText: (req: { text: string; style?: string }) =>
    tauriApiClient.rewriteText(req) as Promise<{ rewrittenText: string }>,
  summarizeText: (req: { text: string; maxLength?: number }) =>
    tauriApiClient.summarizeText(req) as Promise<{ summary: string }>,
  suggestTags: (req: { content: string; existingTags?: string[] }) =>
    tauriApiClient.suggestTags(req) as Promise<{ tags: string[] }>,
}

export const syncCommands = {
  getSyncStatus: () =>
    tauriApiClient.getSyncStatus() as Promise<{
      status: string
      timestamp: string
      error?: string
    }>,
  checkConnection: () => tauriApiClient.checkConnection(),
  triggerSync: () => tauriApiClient.triggerSync(),
}

import type { Resource } from '@mosaic/api'

export const assetCommands = {
  uploadFiles: (files: { name: string; data: number[]; mime_type?: string }[], memoId?: string) =>
    tauriApiClient.uploadFiles(files, memoId) as Promise<Resource[]>,
  deleteAssetFile: (filename: string) => tauriApiClient.deleteAssetFile(filename),
  saveTempFile: (filename: string, data: number[]) => tauriApiClient.saveTempFile(filename, data),
  getPresignedImageUrl: (resourceId: string) =>
    tauriApiClient.getPresignedImageUrl(resourceId) as Promise<string>,
}
