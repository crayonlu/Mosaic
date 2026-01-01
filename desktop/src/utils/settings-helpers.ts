import { callRust } from './callRust'
import type { Setting, SetSettingRequest, AIConfig, ShortcutConfig } from '@/types/settings'

export const settingsCommands = {
  getSetting: (key: string) => callRust<Setting | null>('get_setting', { key }),

  getSettings: (category?: string) => callRust<Setting[]>('get_settings', { category }),

  setSetting: (req: SetSettingRequest) => callRust<Setting>('set_setting', { req }),

  deleteSetting: (key: string) => callRust<void>('delete_setting', { key }),

  testAIConnection: (provider: string, baseUrl: string, apiKey: string) =>
    callRust<boolean>('test_ai_connection', { provider, baseUrl, apiKey }),

  enableAutostart: (enabled: boolean) => callRust<void>('enable_autostart', { enabled }),

  isAutostartEnabled: () => callRust<boolean>('is_autostart_enabled', {}),

  registerShowShortcut: (shortcut: string) =>
    callRust<void>('register_show_shortcut', { shortcut }),

  registerCloseShortcut: (shortcut: string) =>
    callRust<void>('register_close_shortcut', { shortcut }),

  unregisterShortcut: (shortcut: string) => callRust<void>('unregister_shortcut', { shortcut }),
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
  getDataDirectory: () => callRust<string>('get_data_directory', {}),

  getDefaultDataDirectory: () => callRust<string>('get_default_data_directory', {}),

  setDataDirectory: (path: string) =>
    callRust<void>('set_data_directory', { newDirectoryPath: path }),

  needsDataMigration: () => callRust<boolean>('needs_data_migration', {}),
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
