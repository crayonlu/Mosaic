import type { SyncCursors, SyncStoreAdapter } from '@mosaic/sync'
import {
  applyPulledDiaries,
  applyPulledMemos,
  applyPulledResources,
  getSyncCursors,
  upsertSyncCursor,
} from '../storage/repositories'

export function createMobileSyncStoreAdapter(): SyncStoreAdapter {
  async function getCursors(): Promise<SyncCursors> {
    return getSyncCursors()
  }

  async function updateCursors(cursors: SyncCursors): Promise<void> {
    for (const [entityType, lastSyncAt] of Object.entries(cursors)) {
      await upsertSyncCursor(entityType, lastSyncAt as number)
    }
  }

  async function clearLocalData(): Promise<void> {
    // noop — sync cursors are kept for incremental pull
  }

  async function applyChanges(changes: {
    memo?: { updated: Record<string, unknown>[]; deletedIds: string[] }
    diary?: { updated: Record<string, unknown>[]; deletedIds: string[] }
    resource?: { updated: Record<string, unknown>[]; deletedIds: string[] }
  }): Promise<void> {
    if (changes.memo) {
      console.log('[Sync][store] applying memos updated:', changes.memo.updated.length, 'deleted:', changes.memo.deletedIds.length)
      await applyPulledMemos(changes.memo.updated, changes.memo.deletedIds)
      console.log('[Sync][store] memos ok')
    }
    if (changes.diary) {
      console.log('[Sync][store] applying diaries updated:', changes.diary.updated.length, 'deleted:', changes.diary.deletedIds.length)
      await applyPulledDiaries(changes.diary.updated, changes.diary.deletedIds)
      console.log('[Sync][store] diaries ok')
    }
    if (changes.resource) {
      console.log('[Sync][store] applying resources updated:', changes.resource.updated.length, 'deleted:', changes.resource.deletedIds.length)
      await applyPulledResources(changes.resource.updated, changes.resource.deletedIds)
      console.log('[Sync][store] resources ok')
    }
  }

  return { getCursors, updateCursors, clearLocalData, applyChanges }
}
