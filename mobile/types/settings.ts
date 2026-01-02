/**
 * Settings Types
 * Application configuration and preferences
 */

export interface AppSettings {
  theme: 'light' | 'dark' | 'auto'
  language: string
  notifications: boolean
  backupEnabled: boolean
  autoSaveDelay: number // milliseconds
  editorDefaultHeight: number
}
