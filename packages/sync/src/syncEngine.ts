import type { ClientId, SyncApiAdapter, SyncCursors, SyncResult, SyncStatus } from './types'

export interface SyncStoreAdapter {
  getCursors(): Promise<SyncCursors>
  updateCursors(cursors: SyncCursors): Promise<void>
  clearLocalData(): Promise<void>
  applyChanges?(changes: {
    memo?: { updated: Record<string, unknown>[]; deletedIds: string[] }
    diary?: { updated: Record<string, unknown>[]; deletedIds: string[] }
    resource?: { updated: Record<string, unknown>[]; deletedIds: string[] }
    bot?: { updated: Record<string, unknown>[]; deletedIds: string[] }
  }): Promise<void>
}

export interface SyncConfig {
  clientId: ClientId
  onStatusChange?: (status: SyncStatus) => void
}

export function createSyncEngine(api: SyncApiAdapter, store: SyncStoreAdapter, config: SyncConfig) {
  let status: SyncStatus = 'idle'
  let lastSyncAt = 0

  function setStatus(s: SyncStatus) {
    status = s
    config.onStatusChange?.(s)
  }

  async function sync(): Promise<SyncResult> {
    setStatus('syncing')

    let cursors: SyncCursors | undefined
    try {
      cursors = await store.getCursors()
    } catch (e) {
      console.error('[Sync] getCursors failed:', e)
      setStatus('offline')
      return { status: 'offline', pulledCount: 0 }
    }

    let pullResponse: Awaited<ReturnType<SyncApiAdapter['pull']>>
    try {
      pullResponse = await api.pull({ clientId: config.clientId, cursors })
    } catch (e: any) {
      console.error('[Sync] api.pull failed:', e?.message ?? e, 'status:', e?.status, 'stack:', e?.stack)
      setStatus('offline')
      return { status: 'offline', pulledCount: 0 }
    }

    try {
      if (store.applyChanges) {
        await store.applyChanges(pullResponse.changes)
      }
      await store.updateCursors(pullResponse.cursors)
    } catch (e) {
      console.error('[Sync] applyChanges/updateCursors failed:', e)
      setStatus('offline')
      return { status: 'offline', pulledCount: 0 }
    }

    const pulledCount = countChanges(pullResponse.changes)
    lastSyncAt = Date.now()
    setStatus('completed')
    return { status: 'completed', pulledCount }
  }

  function getStatus(): SyncStatus {
    return status
  }

  function getLastSyncAt(): number {
    return lastSyncAt
  }

  return {
    sync,
    getStatus,
    getLastSyncAt,
    setStatus,
  }
}

function countChanges(changes: {
  memo?: { updated?: unknown[]; deletedIds?: string[] }
  diary?: { updated?: unknown[]; deletedIds?: string[] }
  resource?: { updated?: unknown[]; deletedIds?: string[] }
  bot?: { updated?: unknown[]; deletedIds?: string[] }
}) {
  let count = 0
  for (const key of ['memo', 'diary', 'resource', 'bot'] as const) {
    const c = changes[key]
    if (c?.updated) count += c.updated.length
    if (c?.deletedIds) count += c.deletedIds.length
  }
  return count
}
