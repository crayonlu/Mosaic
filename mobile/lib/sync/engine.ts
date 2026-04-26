import { createSyncEngine, type SyncStatus } from '@mosaic/sync'
import { createMobileSyncApiAdapter } from './apiAdapter'
import { createMobileSyncStoreAdapter } from './storeAdapter'

const CLIENT_ID_KEY = 'mosaic_sync_client_id'

let cachedClientId: string | null = null

function generateClientId(): string {
  return `mobile_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function getOrCreateClientId(): string {
  if (cachedClientId) return cachedClientId

  const stored = globalThis.localStorage?.getItem(CLIENT_ID_KEY)
  if (stored) {
    cachedClientId = stored
    return stored
  }

  const id = generateClientId()
  globalThis.localStorage?.setItem(CLIENT_ID_KEY, id)
  cachedClientId = id
  return id
}

let syncEngineInstance: ReturnType<typeof createSyncEngine> | null = null

export function getSyncEngine() {
  if (syncEngineInstance) return syncEngineInstance

  const api = createMobileSyncApiAdapter()
  const store = createMobileSyncStoreAdapter()
  const clientId = getOrCreateClientId()

  syncEngineInstance = createSyncEngine(api, store, {
    clientId,
    onStatusChange: (status: SyncStatus) => {
      console.log('[Sync] status:', status)
    },
  })

  return syncEngineInstance
}

export function resetSyncEngine() {
  syncEngineInstance = null
  cachedClientId = null
}
