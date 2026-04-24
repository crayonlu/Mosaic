import type {
  AIConfig,
  ServerConfig,
  SetSettingRequest,
  Setting,
  ShortcutConfig,
} from '@/types/settings'
import type { User } from '@mosaic/api'
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
  setAuthTokens: (accessToken: string, refreshToken: string) =>
    tauriApiClient.setAuthTokens(accessToken, refreshToken),
  clearAuthTokens: () => tauriApiClient.clearAuthTokens(),
  logout: () => tauriApiClient.logout(),
}

export const settingsCommands = {
  getSetting: (key: string) => tauriApiClient.getSetting(key) as Promise<Setting | null>,
  getSettings: (category?: string) => tauriApiClient.getSettings(category) as Promise<Setting[]>,
  setSetting: (req: SetSettingRequest) => tauriApiClient.setSetting(req) as Promise<Setting>,
  deleteSetting: (key: string) => tauriApiClient.deleteSetting(key),
  testAIConnection: (
    provider: string,
    baseUrl: string,
    apiKey: string,
    model?: string,
    temperature?: number,
    maxTokens?: number,
    timeout?: number
  ) =>
    tauriApiClient.testAIConnection(
      provider,
      baseUrl,
      apiKey,
      model,
      temperature,
      maxTokens,
      timeout
    ),
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
  await settingsCommands.setSetting({ key: 'ai.provider', value: config.provider, category: 'ai' })
  await settingsCommands.setSetting({ key: 'ai.baseUrl', value: config.baseUrl, category: 'ai' })
  await settingsCommands.setSetting({ key: 'ai.apiKey', value: config.apiKey, category: 'ai' })
  if (config.model) {
    await settingsCommands.setSetting({ key: 'ai.model', value: config.model, category: 'ai' })
  }
  if (config.temperature !== undefined) {
    await settingsCommands.setSetting({
      key: 'ai.temperature',
      value: config.temperature.toString(),
      category: 'ai',
    })
  }
  if (config.maxTokens !== undefined) {
    await settingsCommands.setSetting({
      key: 'ai.maxTokens',
      value: config.maxTokens.toString(),
      category: 'ai',
    })
  }
  if (config.timeout !== undefined) {
    await settingsCommands.setSetting({
      key: 'ai.timeout',
      value: config.timeout.toString(),
      category: 'ai',
    })
  }
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
