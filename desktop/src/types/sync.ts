export type SyncStatus = 'idle' | 'syncing' | 'error' | 'completed'

export interface SyncStatusInfo {
  status: SyncStatus
  timestamp: string
  error?: string
}

export type SyncConnectionStatus = 'online' | 'offline'
