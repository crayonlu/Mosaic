/**
 * Settings Types
 * Application configuration and preferences
 */

export interface Setting {
  id: string
  key: string
  value: string
  category: string
  createdAt: number // timestamp in milliseconds
  updatedAt: number // timestamp in milliseconds
}

export enum SettingCategory {
  App = 'app',
  User = 'user',
  System = 'system',
  AI = 'ai',
  Sync = 'sync',
}

export enum SettingKey {
  // App settings
  Theme = 'theme',
  Language = 'language',
  EditorDefaultHeight = 'editor_default_height',
  AutoSaveDelay = 'auto_save_delay',

  // User settings
  Username = 'username',
  AvatarUrl = 'avatar_url',

  // System settings
  AutoStart = 'auto_start',
  MinimizeToTray = 'minimize_to_tray',
  ShowInTaskbar = 'show_in_taskbar',

  // AI settings
  AIProvider = 'ai_provider',
  AIModel = 'ai_model',
  AIAPIKey = 'ai_api_key',
  AIEndpoint = 'ai_endpoint',

  // Sync settings
  SyncEnabled = 'sync_enabled',
  LastSyncTime = 'last_sync_time',
  SyncServerUrl = 'sync_server_url',
  SyncAuthToken = 'sync_auth_token',
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'auto'
  language: string
  notifications: boolean
  backupEnabled: boolean
  autoSaveDelay: number // milliseconds
  editorDefaultHeight: number
}
