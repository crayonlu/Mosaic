export type ClientId = string

export type SyncEntityType = 'memo' | 'diary' | 'resource' | 'bot'

export interface SyncCursors {
  [entity: string]: number
}

export interface EntityChanges<T> {
  updated: T[]
  deletedIds: string[]
}

export interface SyncChanges {
  memo?: EntityChanges<Record<string, unknown>>
  diary?: EntityChanges<Record<string, unknown>>
  resource?: EntityChanges<Record<string, unknown>>
  bot?: EntityChanges<Record<string, unknown>>
}

export interface SyncPullRequest {
  clientId: ClientId
  cursors: SyncCursors
}

export interface SyncPullResponse {
  cursors: SyncCursors
  changes: SyncChanges
}

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'completed'

export interface SyncApiAdapter {
  pull(request: SyncPullRequest): Promise<SyncPullResponse>
}

export interface SyncResult {
  status: SyncStatus
  pulledCount: number
}
